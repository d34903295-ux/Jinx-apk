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

        // Ya completo y verificado: nada que hacer.
        if (final.exists() && final.length() == model.expectedBytes) {
            emit(DownloadState.Done(final))
            return
        }
        // Restos de otra versión: empezar de cero.
        if (part.exists() && part.length() > model.expectedBytes) {
            part.delete()
        }

        var downloaded = downloadedSoFar(part)
        doneBytes.set(downloaded)
        val startTime = System.currentTimeMillis()
        // Velocidad con ventana móvil para que MB/s sea estable.
        var windowStart = startTime
        var windowBytes = downloaded

        try {
            while (true) {
                if (stopped.get()) {
                    emit(DownloadState.Paused(downloaded, model.expectedBytes))
                    return
                }
                val reqBuilder = Request.Builder().url(model.url)
                if (downloaded > 0) reqBuilder.header("Range", "bytes=$downloaded-")
                client.newCall(reqBuilder.build()).execute().use { resp ->
                    if (downloaded > 0 && resp.code == 200) {
                        // El servidor ignoró el Range: reiniciar limpio.
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
                            if (n < 0) break
                            raf.write(buf, 0, n)
                            downloaded += n
                            doneBytes.set(downloaded)
                            val now = System.currentTimeMillis()
                            if (now - windowStart >= 1000) {
                                val dt = (now - windowStart) / 1000.0
                                val bps = (downloaded - windowBytes) / dt
                                val eta = if (bps > 0) ((model.expectedBytes - downloaded) / bps).toLong() else -1L
                                emit(DownloadState.Running(DownloadProgress(downloaded, model.expectedBytes, bps, eta)))
                                windowStart = now
                                windowBytes = downloaded
                            }
                        }
                    }
                    if (stopped.get() || paused.get()) {
                        emit(DownloadState.Paused(downloaded, model.expectedBytes))
                        return
                    }
                    if (downloaded >= model.expectedBytes) break
                    // El servidor cortó antes: reintentar el rango restante.
                    Log.w(TAG, "Corte prematuro en $downloaded, reintentando")
                    Thread.sleep(1500)
                }
            }
            if (part.length() == model.expectedBytes) {
                if (!part.renameTo(final)) {
                    emit(DownloadState.Error("No se pudo mover el archivo final"))
                    return
                }
                emit(DownloadState.Done(final))
            } else {
                emit(DownloadState.Error("Tamaño final inesperado: ${part.length()}"))
            }
        } catch (e: InterruptedException) {
            emit(DownloadState.Paused(downloaded, model.expectedBytes))
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

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS) // streaming largo sin timeout de lectura
            .retryOnConnectionFailure(true)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }
}
