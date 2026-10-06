package com.example.jinx.speech

import android.content.Context
import android.util.Log
import com.example.jinx.llama.NativeModel
import java.io.BufferedInputStream
import java.io.File
import java.util.concurrent.Executors
import java.util.zip.ZipInputStream
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService

/** Modelo de voz español (Vosk, ~38 MB, 100% offline tras descargar). */
val VOSK_MODEL = NativeModel(
    id = "vosk-es",
    label = "Voz español (dictado)",
    language = "ES",
    fileName = "vosk-model-small-es-0.42.zip",
    url = "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip",
    expectedBytes = 39_817_833L,
    ramNeededMB = 256,
    sha256 = "",
)

/** Dictado offline con Vosk. */
object VoskManager {
    private const val TAG = "NODO_VOSK"
    private val exec = Executors.newSingleThreadExecutor()
    private var speechService: SpeechService? = null

    fun modelDir(filesDir: File): File = File(filesDir, "vosk").apply { mkdirs() }

    fun isReady(filesDir: File): Boolean {
        val dir = modelDir(filesDir)
        return File(dir, "vosk-model-small-es-0.42").exists()
    }

    fun downloadedZip(filesDir: File): File = File(modelDir(filesDir), VOSK_MODEL.fileName)

    /** Descomprime el zip descargado. */
    fun unzipIfNeeded(filesDir: File): Boolean {
        return try {
            val dir = modelDir(filesDir)
            val target = File(dir, "vosk-model-small-es-0.42")
            if (target.exists()) return true
            val zip = downloadedZip(filesDir)
            if (!zip.exists() || zip.length() != VOSK_MODEL.expectedBytes) return false
            ZipInputStream(BufferedInputStream(zip.inputStream())).use { zin ->
                var entry = zin.nextEntry
                while (entry != null) {
                    val out = File(dir, entry.name)
                    if (entry.isDirectory) {
                        out.mkdirs()
                    } else {
                        out.parentFile?.mkdirs()
                        out.outputStream().use { out_s -> zin.copyTo(out_s) }
                    }
                    zin.closeEntry()
                    entry = zin.nextEntry
                }
            }
            target.exists()
        } catch (e: Exception) {
            Log.e(TAG, "unzip failed", e)
            false
        }
    }

    interface Listener {
        fun onPartial(text: String)
        fun onFinal(text: String)
        fun onError(message: String)
    }

    fun start(filesDir: File, listener: Listener) {
        stop()
        exec.execute {
            try {
                if (!unzipIfNeeded(filesDir)) {
                    listener.onError("Modelo de voz no descargado")
                    return@execute
                }
                val model = Model(File(modelDir(filesDir), "vosk-model-small-es-0.42").absolutePath)
                val rec = Recognizer(model, 16000.0f)
                val service = SpeechService(rec, 16000.0f)
                speechService = service
                service.startListening(object : RecognitionListener {
                    override fun onPartialResult(hypothesis: String?) {
                        listener.onPartial(parseText(hypothesis))
                    }

                    override fun onResult(hypothesis: String?) {
                        val t = parseText(hypothesis)
                        if (t.isNotBlank()) listener.onFinal(t)
                    }

                    override fun onFinalResult(hypothesis: String?) {
                        val t = parseText(hypothesis)
                        if (t.isNotBlank()) listener.onFinal(t)
                    }

                    override fun onError(e: Exception?) {
                        listener.onError(e?.message ?: "Error de micrófono")
                    }

                    override fun onTimeout() {
                        listener.onError("timeout")
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "start failed", e)
                listener.onError(e.message ?: "Error")
            }
        }
    }

    fun stop() {
        try {
            speechService?.stop()
            speechService?.shutdown()
        } catch (_: Exception) {
        }
        speechService = null
    }

    private fun parseText(hypothesis: String?): String {
        if (hypothesis.isNullOrBlank()) return ""
        return try {
            val obj = org.json.JSONObject(hypothesis)
            obj.optString("partial", obj.optString("text", ""))
        } catch (_: Exception) {
            ""
        }
    }
}
