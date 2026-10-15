package com.example.jinx.llama

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

data class ImportProgress(
    val modelId: String,
    val copiedBytes: Long,
    val totalBytes: Long,
    val bytesPerSecond: Double,
    val etaSeconds: Long,
    val isVerifying: Boolean = false,
    val error: String? = null
)

/**
 * Gestor de importación de modelos .gguf vía Storage Access Framework (SAF).
 * Copia en streaming con búfer de 2 MB sin cargar el archivo en memoria.
 */
object ModelImporter {
    private const val TAG = "NODO_IMPORT"
    private const val BUFFER_SIZE = 2 * 1024 * 1024 // 2 MB buffer en streaming

    private val executor = Executors.newSingleThreadExecutor()
    private val cancelled = AtomicBoolean(false)

    @Volatile
    var currentProgress: ImportProgress? = null
        private set

    var onProgressUpdate: ((ImportProgress?) -> Unit)? = null

    fun isImporting(modelId: String): Boolean = currentProgress?.modelId == modelId

    fun cancelImport() {
        cancelled.set(true)
        val p = currentProgress
        if (p != null) {
            currentProgress = null
            onProgressUpdate?.invoke(null)
        }
    }

    fun startImport(
        context: Context,
        modelId: String,
        uri: Uri,
        onComplete: ((Boolean, String?) -> Unit)? = null
    ) {
        val model = NATIVE_MODELS.firstOrNull { it.id == modelId }
        if (model == null) {
            onComplete?.invoke(false, "Modelo no encontrado en el catálogo")
            return
        }

        cancelled.set(false)
        val modelsDir = LlamaEngine.modelsDir(context.filesDir)
        val partFile = File(modelsDir, model.fileName + ".part")
        val finalFile = LlamaEngine.modelFile(context.filesDir, model)

        executor.execute {
            var input: java.io.InputStream? = null
            var output: FileOutputStream? = null

            try {
                // 1. Metadatos del archivo origen desde SAF
                var sourceSize = -1L
                var sourceDisplayName = ""
                try {
                    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                        if (cursor.moveToFirst()) {
                            val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                            if (sizeIdx != -1 && !cursor.isNull(sizeIdx)) {
                                sourceSize = cursor.getLong(sizeIdx)
                            }
                            val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                            if (nameIdx != -1 && !cursor.isNull(nameIdx)) {
                                sourceDisplayName = cursor.getString(nameIdx) ?: ""
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "No se pudo leer metadatos de SAF: ${e.message}")
                }

                val totalTargetBytes = if (sourceSize > 0) sourceSize else model.expectedBytes

                // 2. Control de espacio libre en disco (tamaño + 100 MB de margen)
                val freeSpace = context.filesDir.usableSpace
                if (freeSpace < totalTargetBytes + 100L * 1024 * 1024) {
                    val neededMB = totalTargetBytes / 1048576
                    val msg = "Espacio insuficiente en disco. Se requieren $neededMB MB libres."
                    Log.e(TAG, msg)
                    reportError(modelId, msg)
                    onComplete?.invoke(false, msg)
                    return@execute
                }

                // 3. Abrir flujo de lectura
                input = context.contentResolver.openInputStream(uri) ?: run {
                    val msg = "No se pudo acceder al archivo seleccionado"
                    reportError(modelId, msg)
                    onComplete?.invoke(false, msg)
                    return@execute
                }

                if (partFile.exists()) partFile.delete()
                output = FileOutputStream(partFile)

                val buffer = ByteArray(BUFFER_SIZE)
                var bytesCopied = 0L
                val startTime = System.currentTimeMillis()
                var windowStart = startTime
                var windowBytes = 0L

                updateProgress(ImportProgress(modelId, 0L, totalTargetBytes, 0.0, -1L))

                // 4. Copia en streaming
                while (true) {
                    if (cancelled.get()) {
                        Log.w(TAG, "Importación cancelada por el usuario")
                        output.close()
                        input.close()
                        if (partFile.exists()) partFile.delete()
                        currentProgress = null
                        onProgressUpdate?.invoke(null)
                        onComplete?.invoke(false, "Importación cancelada")
                        return@execute
                    }

                    val read = input.read(buffer)
                    if (read < 0) break
                    output.write(buffer, 0, read)
                    bytesCopied += read

                    val now = System.currentTimeMillis()
                    if (now - windowStart >= 350) {
                        val dt = (now - windowStart) / 1000.0
                        val speed = if (dt > 0) (bytesCopied - windowBytes) / dt else 0.0
                        val eta = if (speed > 0 && totalTargetBytes > bytesCopied) {
                            ((totalTargetBytes - bytesCopied) / speed).toLong()
                        } else -1L

                        updateProgress(ImportProgress(modelId, bytesCopied, totalTargetBytes, speed, eta))
                        windowStart = now
                        windowBytes = bytesCopied
                    }
                }

                output.flush()
                output.close()
                input.close()

                if (cancelled.get()) {
                    if (partFile.exists()) partFile.delete()
                    currentProgress = null
                    onProgressUpdate?.invoke(null)
                    onComplete?.invoke(false, "Importación cancelada")
                    return@execute
                }

                // 5. Validaciones post-copia
                updateProgress(
                    ImportProgress(modelId, bytesCopied, totalTargetBytes, 0.0, 0L, isVerifying = true)
                )

                // 5.1. Validar que sea GGUF o .litertlm válido
                val isLitertlm = model.format == "litertlm" || model.fileName.endsWith(".litertlm") || sourceDisplayName.endsWith(".litertlm")
                val isGguf = ModelDownloader.isValidGguf(partFile)
                if (!isLitertlm && !isGguf) {
                    if (partFile.exists()) partFile.delete()
                    val msg = "El archivo seleccionado no es un formato válido (.litertlm o .gguf)."
                    Log.e(TAG, msg)
                    reportError(modelId, msg)
                    onComplete?.invoke(false, msg)
                    return@execute
                }

                // 5.2. Validar tamaño (para GGUF con tamaño estricto o .litertlm > 30 MB)
                val actualLength = partFile.length()
                val expected = model.expectedBytes
                if (expected > 0 && !isLitertlm) {
                    val diff = Math.abs(actualLength - expected).toDouble()
                    val ratio = diff / expected.toDouble()
                    if (ratio > 0.05) {
                        if (partFile.exists()) partFile.delete()
                        val msg = "El tamaño (${actualLength / 1048576} MB) difiere del esperado (${expected / 1048576} MB)."
                        Log.e(TAG, msg)
                        reportError(modelId, msg)
                        onComplete?.invoke(false, msg)
                        return@execute
                    }
                } else if (actualLength < 30_000_000L) {
                    if (partFile.exists()) partFile.delete()
                    val msg = "El archivo seleccionado es demasiado pequeño (< 30 MB) para ser un modelo LLM."
                    Log.e(TAG, msg)
                    reportError(modelId, msg)
                    onComplete?.invoke(false, msg)
                    return@execute
                }

                // 6. Promover a archivo final en filesDir/models/
                if (finalFile.exists()) finalFile.delete()
                if (!ModelDownloader.promotePartToFinal(partFile, finalFile)) {
                    val msg = "Error al guardar el archivo del modelo en el almacenamiento local."
                    Log.e(TAG, msg)
                    reportError(modelId, msg)
                    onComplete?.invoke(false, msg)
                    return@execute
                }

                Log.i(TAG, "Modelo importado y listo: ${finalFile.name} (${finalFile.length()} bytes)")
                currentProgress = null
                onProgressUpdate?.invoke(null)
                onComplete?.invoke(true, null)

            } catch (e: Exception) {
                Log.e(TAG, "Error importando modelo", e)
                try {
                    output?.close()
                    input?.close()
                    if (partFile.exists()) partFile.delete()
                } catch (_: Exception) {}

                val msg = if (e.message?.contains("ENOSPC", ignoreCase = true) == true) {
                    "Sin espacio suficiente en disco."
                } else {
                    "Error al importar: ${e.message ?: "error de lectura"}"
                }
                reportError(modelId, msg)
                onComplete?.invoke(false, msg)
            }
        }
    }

    private fun updateProgress(progress: ImportProgress) {
        currentProgress = progress
        onProgressUpdate?.invoke(progress)
    }

    private fun reportError(modelId: String, errorMsg: String) {
        val errProgress = ImportProgress(modelId, 0L, 0L, 0.0, -1L, error = errorMsg)
        currentProgress = errProgress
        onProgressUpdate?.invoke(errProgress)
    }
}
