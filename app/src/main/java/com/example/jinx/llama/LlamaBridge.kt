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
    }

    external fun generate(handle: Long, prompt: String, maxTokens: Int, callback: GenerateCallback): String
    external fun stop(handle: Long)
    external fun free(handle: Long)
}
