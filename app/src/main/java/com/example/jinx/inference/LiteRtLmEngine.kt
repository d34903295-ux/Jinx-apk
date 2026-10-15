package com.example.jinx.inference

import android.content.Context
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.LogSeverity
import com.google.ai.edge.litertlm.SamplerConfig
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.regex.Pattern
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class LiteRtLmEngine(private val context: Context? = null) : InferenceEngine {
    private val scope = CoroutineScope(Dispatchers.Default)
    private var engine: Engine? = null
    private var activeConversation: Conversation? = null
    private var currentJob: Job? = null
    private val isStopping = AtomicBoolean(false)

    override var backendName: String = "LiteRT-LM (Auto)"
        private set
    override var isLoaded: Boolean = false
        private set
    override var activeModelId: String? = null
        private set

    companion object {
        private const val TAG = "LiteRtLmEngine"
        private val UNUSED_TOKEN_REGEX = Pattern.compile("<unused\\d+>", Pattern.CASE_INSENSITIVE)
        private val CONTROL_TOKEN_REGEX = Pattern.compile(
            "<start_of_turn>|<end_of_turn>|<\\|im_start\\|>|<\\|im_end\\|>|<\\|eot_id\\|>|<pad>|<s>|</s>|<eos>",
            Pattern.CASE_INSENSITIVE
        )

        fun cleanOutputText(raw: String): String {
            var text = UNUSED_TOKEN_REGEX.matcher(raw).replaceAll("")
            text = CONTROL_TOKEN_REGEX.matcher(text).replaceAll("")
            return text
        }
    }

    override fun loadModel(
        modelPath: String,
        modelId: String,
        nCtx: Int,
        nThreads: Int,
        onProgress: ((Float) -> Unit)?
    ): Boolean {
        unload()
        try {
            Engine.setNativeMinLogSeverity(LogSeverity.ERROR)
        } catch (_: Throwable) {}

        val file = File(modelPath)
        if (!file.exists() || file.length() == 0L) {
            Log.e(TAG, "Model file not found: $modelPath")
            return false
        }

        val maxTokens = nCtx.coerceIn(2048, 4096)
        val cacheDir = context?.cacheDir?.absolutePath ?: (file.parentFile?.absolutePath ?: "/data/local/tmp")

        // 1. Intentar Backend.GPU() primero para aceleración por hardware (OpenCL / Vulkan / Drift)
        Log.i(TAG, "Initializing LiteRT-LM model: $modelId via Backend.GPU()...")
        var loadedEngine: Engine? = null
        var currentBackend = "LiteRT-LM (GPU)"

        try {
            val gpuConfig = EngineConfig(
                modelPath = modelPath,
                backend = Backend.GPU(),
                maxNumTokens = maxTokens,
                cacheDir = cacheDir
            )
            val eng = Engine(gpuConfig)
            eng.initialize()
            loadedEngine = eng
            Log.i(TAG, "LiteRT-LM successfully initialized with Backend.GPU()")
        } catch (gpuErr: Throwable) {
            Log.w(TAG, "GPU backend failed, falling back to CPU: ${gpuErr.message}")
            try {
                val cpuConfig = EngineConfig(
                    modelPath = modelPath,
                    backend = Backend.CPU(),
                    maxNumTokens = maxTokens,
                    cacheDir = cacheDir
                )
                val eng = Engine(cpuConfig)
                eng.initialize()
                loadedEngine = eng
                currentBackend = "LiteRT-LM (CPU)"
                Log.i(TAG, "LiteRT-LM successfully initialized with Backend.CPU()")
            } catch (cpuErr: Throwable) {
                Log.e(TAG, "Failed to load model on both GPU and CPU: ${cpuErr.message}", cpuErr)
                return false
            }
        }

        engine = loadedEngine
        backendName = currentBackend
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
        val eng = engine
        if (eng == null || !isLoaded) {
            onError("LiteRT-LM engine is not loaded")
            return
        }

        stop()
        isStopping.set(false)

        currentJob = scope.launch {
            val startTime = System.currentTimeMillis()
            var firstTokenTime = 0L
            var promptTokensEstimate = 0
            var generatedCount = 0
            val fullTextBuilder = StringBuilder()

            try {
                // Parsear mensajes de JSON si vienen estructurados del chat
                var systemInstruction = "Responde en español, directo y preciso. Si es simple, responde en 1-2 frases."
                var userPrompt = promptOrJson.trim()

                if (userPrompt.startsWith("[") && userPrompt.endsWith("]")) {
                    try {
                        val arr = JSONArray(userPrompt)
                        val parts = mutableListOf<String>()
                        for (i in 0 until arr.length()) {
                            val obj = arr.getJSONObject(i)
                            val role = obj.optString("role", "user")
                            val content = obj.optString("content", "")
                            if (role == "system") {
                                systemInstruction = content
                            } else if (role == "user") {
                                parts.add(content)
                            } else if (role == "assistant") {
                                parts.add("Asistente: $content")
                            }
                        }
                        if (parts.isNotEmpty()) {
                            userPrompt = parts.joinToString("\n\n")
                        }
                    } catch (_: Exception) {}
                }

                promptTokensEstimate = (userPrompt.length / 3.5).toInt().coerceAtLeast(1)

                val samplerConfig = SamplerConfig(
                    topK = topK.coerceAtLeast(1),
                    topP = topP.toDouble().coerceIn(0.05, 1.0),
                    temperature = temperature.toDouble().coerceIn(0.0, 1.5)
                )

                val convConfig = ConversationConfig(
                    systemInstruction = Contents.of(systemInstruction),
                    samplerConfig = samplerConfig,
                    maxOutputToken = maxTokens.coerceIn(16, 2048)
                )

                val conversation = eng.createConversation(convConfig)
                activeConversation = conversation

                val flow = conversation.sendMessageAsync(userPrompt)
                flow.collect { message ->
                    if (isStopping.get()) {
                        return@collect
                    }
                    val contents = message.contents.contents
                    val textPieces = contents.filterIsInstance<Content.Text>().map { it.text }
                    for (rawPiece in textPieces) {
                        val clean = cleanOutputText(rawPiece)
                        if (clean.isNotEmpty()) {
                            if (firstTokenTime == 0L) {
                                firstTokenTime = System.currentTimeMillis()
                            }
                            generatedCount++
                            fullTextBuilder.append(clean)
                            onToken(clean)
                        }
                    }
                }

                val endTime = System.currentTimeMillis()
                val totalTimeMs = endTime - startTime
                val ttftMs = if (firstTokenTime > 0L) firstTokenTime - startTime else totalTimeMs
                val genDurationMs = if (firstTokenTime > 0L) (endTime - firstTokenTime) else totalTimeMs
                val tokPerSec = if (genDurationMs > 0 && generatedCount > 0) {
                    (generatedCount * 1000f) / genDurationMs
                } else if (totalTimeMs > 0 && generatedCount > 0) {
                    (generatedCount * 1000f) / totalTimeMs
                } else 0f

                val stats = GenerationStats(
                    promptTokens = promptTokensEstimate,
                    generatedTokens = generatedCount,
                    timeToFirstTokenMs = ttftMs,
                    totalTimeMs = totalTimeMs,
                    tokensPerSecond = tokPerSec,
                    backend = backendName,
                    modelId = activeModelId ?: "litertlm"
                )

                Log.i(
                    TAG,
                    "LiteRT-LM finished: $generatedCount tokens in ${totalTimeMs}ms (TTFT: ${ttftMs}ms, ${tokPerSec} tok/s) [$backendName]"
                )

                onDone(fullTextBuilder.toString(), stats)
            } catch (err: Throwable) {
                if (!isStopping.get()) {
                    Log.e(TAG, "LiteRT-LM generation error: ${err.message}", err)
                    onError(err.message ?: "Error desconocido en inferencia LiteRT-LM")
                }
            } finally {
                try {
                    activeConversation?.close()
                } catch (_: Throwable) {}
                activeConversation = null
            }
        }
    }

    override fun stop() {
        isStopping.set(true)
        currentJob?.cancel()
        currentJob = null
        try {
            activeConversation?.close()
        } catch (_: Throwable) {}
        activeConversation = null
    }

    override fun unload() {
        stop()
        try {
            engine?.close()
        } catch (e: Throwable) {
            Log.w(TAG, "Error closing LiteRT-LM engine: ${e.message}")
        }
        engine = null
        isLoaded = false
        activeModelId = null
    }
}
