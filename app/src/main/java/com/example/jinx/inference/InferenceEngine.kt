package com.example.jinx.inference

data class GenerationStats(
    val promptTokens: Int,
    val generatedTokens: Int,
    val timeToFirstTokenMs: Long,
    val totalTimeMs: Long,
    val tokensPerSecond: Float,
    val backend: String,
    val modelId: String
)

interface InferenceEngine {
    val backendName: String
    val isLoaded: Boolean
    val activeModelId: String?

    fun loadModel(
        modelPath: String,
        modelId: String,
        nCtx: Int = 2048,
        nThreads: Int = 4,
        onProgress: ((Float) -> Unit)? = null
    ): Boolean

    fun generate(
        promptOrJson: String,
        maxTokens: Int = 512,
        temperature: Float = 0.65f,
        topP: Float = 0.9f,
        topK: Int = 40,
        onToken: (String) -> Unit,
        onDone: (fullText: String, stats: GenerationStats) -> Unit,
        onError: (String) -> Unit
    )

    fun stop()
    fun unload()
}
