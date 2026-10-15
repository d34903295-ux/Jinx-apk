package com.example.jinx.llama

/**
 * Puente JNI con libnative-lib (llama.cpp).
 * Toda llamada bloqueante debe hacerse fuera del hilo principal.
 */
object LlamaBridge {
    @Volatile
    var loaded = false
        private set

    fun ensureLoaded(): Boolean {
        if (loaded) return true
        return try {
            System.loadLibrary("native-lib")
            loaded = true
            true
        } catch (e: UnsatisfiedLinkError) {
            android.util.Log.e("NODO_LLAMA", "No se pudo cargar native-lib", e)
            false
        }
    }

    /** Devuelve un handle (>0) o 0 si falla. nThreads 0 = automático. */
    external fun initModel(path: String, nCtx: Int, nThreads: Int): Long

    interface GenerateCallback {
        fun onToken(piece: String)
        fun onDone(fullText: String)
        fun onStats(promptTokens: Int, genTokens: Int, ttftMs: Long, totalMs: Long, tokPerSec: Float) {}
    }

    external fun generateFull(
        handle: Long,
        prompt: String,
        maxTokens: Int,
        temp: Float,
        topP: Float,
        topK: Int,
        minP: Float,
        repeatPenalty: Float,
        callback: GenerateCallback
    ): String

    fun generate(handle: Long, prompt: String, maxTokens: Int, callback: GenerateCallback): String {
        return generateFull(handle, prompt, maxTokens, 0.65f, 0.9f, 40, 0.05f, 1.1f, callback)
    }

    external fun stop(handle: Long)
    external fun free(handle: Long)
}
