package com.example.jinx.inference

import android.content.Context
import android.util.Log
import com.example.jinx.llama.LlamaBridge
import com.example.jinx.llama.LlamaEngine
import com.example.jinx.llama.ModelProfile
import com.example.jinx.llama.NATIVE_MODELS
import com.example.jinx.llama.getProfile
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class LlamaCppEngine(private val context: Context? = null) : InferenceEngine {
    private val executor = Executors.newSingleThreadExecutor()
    private var handle: Long = 0L
    private val isStopping = AtomicBoolean(false)

    override var backendName: String = "llama.cpp (CPU NEON)"
        private set
    override var isLoaded: Boolean = false
        private set
    override var activeModelId: String? = null
        private set

    companion object {
        private const val TAG = "LlamaCppEngine"
    }

    override fun loadModel(
        modelPath: String,
        modelId: String,
        nCtx: Int,
        nThreads: Int,
        onProgress: ((Float) -> Unit)?
    ): Boolean {
        unload()
        if (!LlamaBridge.ensureLoaded()) {
            Log.e(TAG, "Failed to load native-lib for llama.cpp")
            return false
        }

        val file = File(modelPath)
        if (!file.exists() || file.length() == 0L) {
            Log.e(TAG, "GGUF model file not found: $modelPath")
            return false
        }

        val profile = getProfile(modelId)

        val threads = if (nThreads > 0) nThreads else (if (profile.nThreads > 0) profile.nThreads else LlamaEngine.detectBigCores())
        val ctx = if (nCtx > 0) nCtx else profile.nCtx

        Log.i(TAG, "Loading GGUF model: $modelId (nCtx=$ctx, threads=$threads)")
        val h = LlamaBridge.initModel(modelPath, ctx, threads)
        if (h == 0L) {
            Log.e(TAG, "LlamaBridge.initModel failed for $modelPath")
            return false
        }

        handle = h
        activeModelId = modelId
        isLoaded = true
        onProgress?.invoke(1.0f)
        return true
    }

    override fun generate(
        promptOrJson: String,
        maxTokens: Int,
        temperature: Float,
        topP: Float,
        topK: Int,
        onToken: (String) -> Unit,
        onDone: (fullText: String, stats: GenerationStats) -> Unit,
        onError: (String) -> Unit
    ) {
        val h = handle
        if (h == 0L || !isLoaded) {
            onError("LlamaCppEngine is not loaded")
            return
        }

        isStopping.set(false)
        val profile = getProfile(activeModelId ?: "")

        val effMaxTokens = if (maxTokens > 0) maxTokens else profile.maxTokens
        val effTemp = if (temperature >= 0f) temperature else profile.temperature
        val effTopP = if (topP >= 0f) topP else profile.topP
        val effTopK = if (topK >= 0) topK else profile.topK
        val effMinP = profile.minP
        val effRepeat = profile.repeatPenalty

        executor.execute {
            var reportedStats: GenerationStats? = null
            val startTime = System.currentTimeMillis()

            try {
                LlamaBridge.generateFull(
                    handle = h,
                    prompt = promptOrJson,
                    maxTokens = effMaxTokens,
                    temp = effTemp,
                    topP = effTopP,
                    topK = effTopK,
                    minP = effMinP,
                    repeatPenalty = effRepeat,
                    callback = object : LlamaBridge.GenerateCallback {
                        override fun onToken(piece: String) {
                            if (!isStopping.get()) {
                                onToken(piece)
                            }
                        }

                        override fun onStats(
                            promptTokens: Int,
                            genTokens: Int,
                            ttftMs: Long,
                            totalMs: Long,
                            tokPerSec: Float
                        ) {
                            reportedStats = GenerationStats(
                                promptTokens = promptTokens,
                                generatedTokens = genTokens,
                                timeToFirstTokenMs = ttftMs,
                                totalTimeMs = totalMs,
                                tokensPerSecond = tokPerSec,
                                backend = backendName,
                                modelId = activeModelId ?: "gguf"
                            )
                        }

                        override fun onDone(fullText: String) {
                            val duration = System.currentTimeMillis() - startTime
                            val finalStats = reportedStats ?: GenerationStats(
                                promptTokens = (promptOrJson.length / 3.5).toInt().coerceAtLeast(1),
                                generatedTokens = (fullText.length / 3.5).toInt().coerceAtLeast(1),
                                timeToFirstTokenMs = duration / 2,
                                totalTimeMs = duration,
                                tokensPerSecond = if (duration > 0) (fullText.length / 3.5f * 1000f) / duration else 0f,
                                backend = backendName,
                                modelId = activeModelId ?: "gguf"
                            )
                            onDone(fullText, finalStats)
                        }
                    }
                )
            } catch (e: Throwable) {
                if (!isStopping.get()) {
                    Log.e(TAG, "Error in LlamaBridge.generateFull: ${e.message}", e)
                    onError(e.message ?: "Error en inferencia llama.cpp")
                }
            }
        }
    }

    override fun stop() {
        isStopping.set(true)
        val h = handle
        if (h != 0L) {
            LlamaBridge.stop(h)
        }
    }

    override fun unload() {
        stop()
        val h = handle
        if (h != 0L) {
            handle = 0L
            LlamaBridge.free(h)
        }
        isLoaded = false
        activeModelId = null
    }
}
