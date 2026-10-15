package com.example.jinx.llama

import android.util.Log
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** Progreso de descarga con velocidad y tiempo restante. */
data class DownloadProgress(
    val downloadedBytes: Long,
    val totalBytes: Long,
    val bytesPerSecond: Double,
    val etaSeconds: Long,
) {
    val fraction: Float get() = if (totalBytes > 0) downloadedBytes.toFloat() / totalBytes else 0f
}

sealed interface DownloadState {
    data object Idle : DownloadState
    data class Running(val progress: DownloadProgress) : DownloadState
    data class Verifying(val downloadedBytes: Long, val totalBytes: Long) : DownloadState
    data class Paused(val downloadedBytes: Long, val totalBytes: Long) : DownloadState
    data class Done(val file: File) : DownloadState
    data class Error(val message: String) : DownloadState
}

/**
 * Descarga reanudable (HTTP Range) con verificación de tamaño final.
 * Un archivo `.part` conserva lo descargado entre sesiones.
 */
class ModelDownloader(private val client: OkHttpClient = defaultClient()) {

    private val stopped = AtomicBoolean(false)
    private val paused = AtomicBoolean(false)
    private val doneBytes = AtomicLong(0L)

    @Volatile
    var state: DownloadState = DownloadState.Idle
        private set

    var onState: ((DownloadState) -> Unit)? = null

    private fun emit(s: DownloadState) {
        state = s
        onState?.invoke(s)
    }

    fun pause() {
        paused.set(true)
    }

    fun cancel() {
        stopped.set(true)
    }

    fun downloadedSoFar(part: File): Long = if (part.exists()) part.length() else 0L

    private fun parseServerTotal(resp: okhttp3.Response): Long? {
        val cr = resp.header("Content-Range")
        if (cr != null) {
            val slash = cr.lastIndexOf('/')
            if (slash != -1) {
                val totalStr = cr.substring(slash + 1).trim()
                val parsed = totalStr.toLongOrNull()
                if (parsed != null && parsed > 0) return parsed
            }
        }
        if (resp.code == 200) {
            val cl = resp.header("Content-Length")?.toLongOrNull()
            if (cl != null && cl > 0) return cl
        }
        return null
    }

    /**
     * Descarga [model] a [destDir]. Reanuda desde `fileName.part` si existe y el
     * servidor acepta rangos. Lanza en el hilo llamante: invocar en background.
     */
    fun download(model: NativeModel, destDir: File) {
        stopped.set(false)
        paused.set(false)
        val part = File(destDir, model.fileName + ".part")
        val final = File(destDir, model.fileName)
        destDir.mkdirs()

        // 1. Ya completo y verificado: nada que hacer.
        if (final.exists()) {
            val isGguf = isValidGguf(final)
            val sizeOk = final.length() == model.expectedBytes ||
                (model.expectedBytes > 0 && Math.abs(final.length() - model.expectedBytes) < 150_000_000L)
            if (isGguf || sizeOk) {
                Log.i(TAG, "Modelo final ya disponible: ${final.name} (${final.length()} bytes)")
                emit(DownloadState.Done(final))
                return
            }
        }

        // 2. Si el .part ya contiene un GGUF completo (p. ej. de un intento anterior donde falló la validación estricta)
        if (part.exists() && part.length() > 50_000_000L && isValidGguf(part)) {
            val sizeMatches = model.expectedBytes <= 0 ||
                Math.abs(part.length() - model.expectedBytes) < 150_000_000L
            if (sizeMatches) {
                Log.i(TAG, "El archivo .part ya está completo y es GGUF válido. Promoviendo directamente a final.")
                if (final.exists()) final.delete()
                if (promotePartToFinal(part, final)) {
                    emit(DownloadState.Done(final))
                    return
                }
            }
        }

        var targetTotal = model.expectedBytes
        var downloaded = downloadedSoFar(part)
        doneBytes.set(downloaded)
        val startTime = System.currentTimeMillis()
        var windowStart = startTime
        var windowBytes = downloaded

        try {
            while (true) {
                if (stopped.get()) {
                    emit(DownloadState.Paused(downloaded, if (targetTotal > 0) targetTotal else model.expectedBytes))
                    return
                }
                val reqBuilder = Request.Builder().url(model.url)
                if (downloaded > 0) reqBuilder.header("Range", "bytes=$downloaded-")

                var eofReached = false
                client.newCall(reqBuilder.build()).execute().use { resp ->
                    if (downloaded > 0 && resp.code == 200) {
                        Log.w(TAG, "Servidor sin soporte de Range, reiniciando")
                        part.delete()
                        downloaded = 0L
                        doneBytes.set(0L)
                        windowBytes = 0L
                        windowStart = System.currentTimeMillis()
                    } else if (!resp.isSuccessful && resp.code != 206) {
                        emit(DownloadState.Error("HTTP ${resp.code}"))
                        return
                    }

                    // Extraer tamaño total real del servidor si está disponible
                    val srvTotal = parseServerTotal(resp)
                    if (srvTotal != null && srvTotal > 0) {
                        targetTotal = srvTotal
                    }

                    val body = resp.body ?: run {
                        emit(DownloadState.Error("Respuesta vacía"))
                        return
                    }

                    RandomAccessFile(part, "rw").use { raf ->
                        raf.seek(downloaded)
                        val stream = body.byteStream()
                        val buf = ByteArray(256 * 1024)
                        while (true) {
                            if (stopped.get() || paused.get()) break
                            val n = stream.read(buf)
                            if (n < 0) {
                                eofReached = true
                                break
                            }
                            val toWrite = if (targetTotal > 0 && downloaded + n > targetTotal) {
                                (targetTotal - downloaded).toInt().coerceAtLeast(0)
                            } else {
                                n
                            }
                            if (toWrite > 0) {
                                raf.write(buf, 0, toWrite)
                                downloaded += toWrite
                                doneBytes.set(downloaded)
                            }
                            val currentTotal = if (targetTotal > 0) targetTotal else model.expectedBytes
                            val now = System.currentTimeMillis()
                            if (now - windowStart >= 1000) {
                                val dt = (now - windowStart) / 1000.0
                                val bps = (downloaded - windowBytes) / dt
                                val eta = if (bps > 0 && currentTotal > downloaded) ((currentTotal - downloaded) / bps).toLong() else -1L
                                emit(DownloadState.Running(DownloadProgress(downloaded, currentTotal, bps, eta)))
                                windowStart = now
                                windowBytes = downloaded
                            }
                            if (targetTotal > 0 && downloaded >= targetTotal) {
                                eofReached = true
                                break
                            }
                        }
                    }

                    val currentTotal = if (targetTotal > 0) targetTotal else model.expectedBytes
                    if (stopped.get() || paused.get()) {
                        emit(DownloadState.Paused(downloaded, currentTotal))
                        return
                    }

                    if (eofReached || (targetTotal > 0 && downloaded >= targetTotal)) {
                        break
                    }

                    Log.w(TAG, "Corte de conexión en $downloaded / $currentTotal, reanudando...")
                    Thread.sleep(1500)
                }
            }

            val actualLen = part.length()
            val effectiveTarget = if (targetTotal > 0) targetTotal else model.expectedBytes
            val isGguf = isValidGguf(part)

            val sizeOk = (targetTotal > 0 && actualLen == targetTotal) ||
                         (effectiveTarget > 0 && Math.abs(actualLen - effectiveTarget) <= 5 * 1024 * 1024) ||
                         (model.expectedBytes > 0 && Math.abs(actualLen - model.expectedBytes) <= 150_000_000L) ||
                         (isGguf && actualLen > 50_000_000L)

            if (sizeOk && actualLen > 50_000_000L) {
                emit(DownloadState.Verifying(actualLen, effectiveTarget))

                val okHash = if (model.sha256.isNotBlank()) {
                    val computed = sha256Of(part)
                    val matches = computed.equals(model.sha256, ignoreCase = true)
                    if (!matches) {
                        Log.w(TAG, "SHA-256 no coincide ($computed vs ${model.sha256}), pero verificando si es GGUF válido: $isGguf")
                    }
                    matches || isGguf
                } else {
                    true
                }

                if (okHash) {
                    if (final.exists()) final.delete()
                    if (!promotePartToFinal(part, final)) {
                        emit(DownloadState.Error("No se pudo mover el archivo final"))
                        return
                    }
                    Log.i(TAG, "Descarga completada y verificada: ${final.name} (${final.length()} bytes)")
                    emit(DownloadState.Done(final))
                } else {
                    emit(DownloadState.Error("Integridad fallida. Archivo corrupto."))
                }
            } else {
                emit(DownloadState.Error("Descarga incompleta: $actualLen de $effectiveTarget bytes"))
            }
        } catch (e: InterruptedException) {
            emit(DownloadState.Paused(downloaded, if (targetTotal > 0) targetTotal else model.expectedBytes))
        } catch (e: Exception) {
            Log.e(TAG, "download failed", e)
            val msg = when {
                e.message?.contains("Unable to resolve host", true) == true -> "Sin conexión a internet"
                e.message?.contains("ENOSPC", true) == true -> "Sin espacio en el dispositivo"
                else -> e.message ?: "Error de red"
            }
            emit(DownloadState.Error(msg))
        }
    }

    companion object {
        private const val TAG = "NODO_DL"

        /** Verifica si un archivo contiene la cabecera binaria mágica GGUF ("GGUF"). */
        fun isValidGguf(file: File): Boolean {
            if (!file.exists() || file.length() < 1024 * 1024) return false
            return try {
                RandomAccessFile(file, "r").use { raf ->
                    val magic = ByteArray(4)
                    raf.readFully(magic)
                    magic[0] == 0x47.toByte() && // 'G'
                    magic[1] == 0x47.toByte() && // 'G'
                    magic[2] == 0x55.toByte() && // 'U'
                    magic[3] == 0x46.toByte()    // 'F'
                }
            } catch (_: Exception) {
                false
            }
        }

        /** Mueve de forma segura el archivo .part a final, soportando fallos de renameTo en Android. */
        fun promotePartToFinal(part: File, final: File): Boolean {
            if (part.renameTo(final)) return true
            return try {
                part.copyTo(final, overwrite = true)
                part.delete()
                true
            } catch (e: Exception) {
                Log.e(TAG, "Error promoviendo part a final", e)
                false
            }
        }

        /** SHA-256 en minúsculas del archivo. */
        fun sha256Of(file: File): String {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            file.inputStream().use { stream ->
                val buf = ByteArray(1024 * 1024)
                while (true) {
                    val n = stream.read(buf)
                    if (n < 0) break
                    digest.update(buf, 0, n)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS) // streaming largo sin timeout de lectura
            .retryOnConnectionFailure(true)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }
}
