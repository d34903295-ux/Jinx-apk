package com.example.jinx.inference

import android.content.Context
import android.util.Log
import java.io.File

object InferenceManager {
    private const val TAG = "InferenceManager"

    private var liteRtEngine: LiteRtLmEngine? = null
    private var llamaCppEngine: LlamaCppEngine? = null
    private var activeEngine: InferenceEngine? = null

    val isLoaded: Boolean
        get() = activeEngine?.isLoaded == true

    val activeModelId: String?
        get() = activeEngine?.activeModelId

    val backendName: String
        get() = activeEngine?.backendName ?: "Sin motor activo"

    fun init(context: Context? = null) {
        if (liteRtEngine == null) {
            liteRtEngine = LiteRtLmEngine(context?.applicationContext)
        }
        if (llamaCppEngine == null) {
            llamaCppEngine = LlamaCppEngine(context?.applicationContext)
        }
    }

    /**
     * Carga un modelo asegurando que solo uno resida en RAM a la vez.
     * Selecciona LiteRtLmEngine (.litertlm / .bin) o LlamaCppEngine (.gguf).
     */
    @Synchronized
    fun loadModel(
        context: Context? = null,
        modelPath: String,
        modelId: String,
        nCtx: Int = 2048,
        nThreads: Int = 0,
        onProgress: ((Float) -> Unit)? = null
    ): Boolean {
        init(context)

        // Descarga garantizada del motor anterior para liberar RAM inmediatamente
        unloadAll()

        val lowerPath = modelPath.lowercase()
        val targetEngine: InferenceEngine = if (lowerPath.endsWith(".litertlm") || lowerPath.endsWith(".bin") || lowerPath.endsWith(".task")) {
            Log.i(TAG, "Routing to LiteRtLmEngine for format: $modelPath")
            liteRtEngine!!
        } else {
            Log.i(TAG, "Routing to LlamaCppEngine for GGUF: $modelPath")
            llamaCppEngine!!
        }

        val success = targetEngine.loadModel(modelPath, modelId, nCtx, nThreads, onProgress)
        if (success) {
            activeEngine = targetEngine
            Log.i(TAG, "Model $modelId loaded successfully on [${targetEngine.backendName}]")
        } else {
            activeEngine = null
            Log.e(TAG, "Failed to load model $modelId with [${targetEngine.backendName}]")
        }
        return success
    }

    fun generate(
        promptOrJson: String,
        maxTokens: Int = 512,
        temperature: Float = 0.65f,
        topP: Float = 0.9f,
        topK: Int = 40,
        onToken: (String) -> Unit,
        onDone: (fullText: String, stats: GenerationStats) -> Unit,
        onError: (String) -> Unit
    ) {
        val engine = activeEngine
        if (engine == null || !engine.isLoaded) {
            onError("No hay ningún modelo cargado en memoria")
            return
        }
        engine.generate(
            promptOrJson = promptOrJson,
            maxTokens = maxTokens,
            temperature = temperature,
            topP = topP,
            topK = topK,
            onToken = onToken,
            onDone = onDone,
            onError = onError
        )
    }

    fun stop() {
        activeEngine?.stop()
    }

    @Synchronized
    fun unloadAll() {
        try {
            activeEngine?.stop()
        } catch (_: Throwable) {}
        try {
            liteRtEngine?.unload()
        } catch (_: Throwable) {}
        try {
            llamaCppEngine?.unload()
        } catch (_: Throwable) {}
        activeEngine = null
    }
}
