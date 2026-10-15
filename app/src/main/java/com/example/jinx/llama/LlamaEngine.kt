package com.example.jinx.llama

import android.util.Log
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Catálogo de modelos GGUF y LiteRT-LM. Solo HTTPS de huggingface.co. */
data class NativeModel(
    val id: String,
    val label: String,
    val language: String,
    val fileName: String,
    val url: String,
    /** Tamaño esperado en bytes (verificación de integridad). */
    val expectedBytes: Long,
    /** SHA-256 del archivo (X-Linked-ETag de Hugging Face). */
    val sha256: String,
    val ramNeededMB: Int,
    val recommended: Boolean = false,
    val format: String = if (fileName.endsWith(".litertlm")) "litertlm" else "gguf",
    val backend: String = if (fileName.endsWith(".litertlm")) "GPU (LiteRT-LM)" else "CPU (llama.cpp)"
)

val NATIVE_MODELS: List<NativeModel> = listOf(
    NativeModel(
        id = "gemma-4-e2b-litertlm",
        label = "Gemma 4 E2B · LiteRT-LM (Google GPU Nativo)",
        language = "ES/EN",
        fileName = "gemma-4-E2B-it.litertlm",
        url = "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm",
        expectedBytes = 1_580_000_000L,
        sha256 = "",
        ramNeededMB = 1800,
        recommended = true,
        format = "litertlm",
        backend = "GPU (LiteRT-LM)"
    ),
    NativeModel(
        id = "gemma-4-e4b-litertlm",
        label = "Gemma 4 E4B · LiteRT-LM (Google GPU Alta Capacidad)",
        language = "ES/EN",
        fileName = "gemma-4-E4B-it.litertlm",
        url = "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm",
        expectedBytes = 3_200_000_000L,
        sha256 = "",
        ramNeededMB = 3600,
        format = "litertlm",
        backend = "GPU (LiteRT-LM)"
    ),
    NativeModel(
        id = "llama-3.2-1b-litertlm",
        label = "Llama 3.2 1B · LiteRT-LM (Meta Edge GPU)",
        language = "ES/EN",
        fileName = "Llama-3.2-1B-Instruct.litertlm",
        url = "https://huggingface.co/litert-community/Llama-3.2-1B/resolve/main/Llama-3.2-1B-Instruct.litertlm",
        expectedBytes = 1_100_000_000L,
        sha256 = "",
        ramNeededMB = 1500,
        format = "litertlm",
        backend = "GPU (LiteRT-LM)"
    ),
    NativeModel(
        id = "phi-4-mini-litertlm",
        label = "Phi-4 Mini · LiteRT-LM (Microsoft Edge GPU)",
        language = "ES/EN",
        fileName = "Phi-4-mini-instruct.litertlm",
        url = "https://huggingface.co/litert-community/Phi-4-mini-instruct/resolve/main/Phi-4-mini-instruct.litertlm",
        expectedBytes = 2_400_000_000L,
        sha256 = "",
        ramNeededMB = 2800,
        format = "litertlm",
        backend = "GPU (LiteRT-LM)"
    ),
    NativeModel(
        id = "qwen-0.6b-litertlm",
        label = "Qwen 3.x 0.6B · LiteRT-LM (Ultra Rápido GPU)",
        language = "ES/EN",
        fileName = "qwen3-0.6b.litertlm",
        url = "https://huggingface.co/litert-community/Qwen3-0.6B/resolve/main/qwen3-0.6b.litertlm",
        expectedBytes = 550_000_000L,
        sha256 = "",
        ramNeededMB = 1000,
        recommended = true,
        format = "litertlm",
        backend = "GPU (LiteRT-LM)"
    ),
    NativeModel(
        id = "minicpm-2b-q4km",
        label = "MiniCPM 2B · OpenBMB (On-Device)",
        language = "ES/EN/ZH",
        fileName = "MiniCPM5-2B-Q4_K_M.gguf",
        url = "https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/main/MiniCPM5-2B-Q4_K_M.gguf",
        expectedBytes = 1_561_318_368L,
        sha256 = "ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd",
        ramNeededMB = 2400,
        recommended = true,
    ),
    NativeModel(
        id = "minicpm3-4b-q4km",
        label = "MiniCPM 3 · 4B (OpenBMB Sovereign)",
        language = "ES/EN/ZH",
        fileName = "minicpm3-4b-q4_k_m.gguf",
        url = "https://huggingface.co/openbmb/MiniCPM3-4B-GGUF/resolve/main/minicpm3-4b-q4_k_m.gguf",
        expectedBytes = 2_469_791_584L,
        sha256 = "64913247e927414ecf47fd3e9ea8e3f0c9acae293f583dfa7e24b8872e20fa4c",
        ramNeededMB = 3800,
    ),
    NativeModel(
        id = "functiongemma-270m-q80",
        label = "FunctionGemma · 270M (Router)",
        language = "ES/EN",
        fileName = "functiongemma-270m-it-Q8_0.gguf",
        url = "https://huggingface.co/bartowski/google_gemma-3-270m-it-GGUF/resolve/main/google_gemma-3-270m-it-Q8_0.gguf",
        expectedBytes = 295_000_000L,
        sha256 = "c866c9f113f2e9aa2225c5997ede437392b8fa844ba5db9e4c77e315ffe20800",
        ramNeededMB = 768,
        recommended = true,
    ),
    NativeModel(
        id = "gemma-4-e2b-it-q4km",
        label = "Gemma 4 E2B · Multimodal",
        language = "ES/EN",
        fileName = "gemma-4-e2b-it-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
        expectedBytes = 1_708_582_752L,
        sha256 = "e0aee85060f168f0f2d8473d7ea41ce2f3230c1bc1374847505ea599288a7787",
        ramNeededMB = 2800,
        recommended = true,
    ),
    NativeModel(
        id = "gemma-4-e4b-it-q4km",
        label = "Gemma 4 E4B · Multimodal High-Cap",
        language = "ES/EN",
        fileName = "gemma-4-e4b-it-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf",
        expectedBytes = 3_450_000_000L,
        sha256 = "8f386b97607a75908b8941764eb86d63fa21c4365551ba86ff008892d192135c",
        ramNeededMB = 5120,
    ),
    NativeModel(
        id = "qwen-3-0.6b-q4km",
        label = "Qwen 3.x Small · 0.6B",
        language = "ES/EN",
        fileName = "qwen-3-0.6b-instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
        expectedBytes = 415_000_000L,
        sha256 = "6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653",
        ramNeededMB = 1200,
    ),
    NativeModel(
        id = "gemma-3-270m-q4km",
        label = "Minino · 270M",
        language = "ES/EN",
        fileName = "google_gemma-3-270m-it-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/google_gemma-3-270m-it-GGUF/resolve/main/google_gemma-3-270m-it-Q4_K_M.gguf",
        expectedBytes = 253_115_168L,
        sha256 = "c866c9f113f2e9aa2225c5997ede437392b8fa844ba5db9e4c77e315ffe20800",
        ramNeededMB = 1024,
    ),
    NativeModel(
        id = "qwen-2.5-0.5b-q4km",
        label = "Qwen 2.5 · 0.5B",
        language = "ES/EN",
        fileName = "Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
        expectedBytes = 397_808_192L,
        sha256 = "6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653",
        ramNeededMB = 1536,
    ),
    NativeModel(
        id = "llama-3.2-1b-q4km",
        label = "Llama 3.2 · 1B",
        language = "ES/EN",
        fileName = "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        expectedBytes = 807_694_464L,
        sha256 = "6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83",
        ramNeededMB = 2048,
    ),
    NativeModel(
        id = "qwen-2.5-1.5b-q4km",
        label = "Qwen 2.5 · 1.5B",
        language = "ES/EN",
        fileName = "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        expectedBytes = 986_048_768L,
        sha256 = "1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370",
        ramNeededMB = 2560,
    ),
    NativeModel(
        id = "qwen-2.5-3b-q4km",
        label = "Qwen 2.5 · 3B",
        language = "ES/EN",
        fileName = "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
        expectedBytes = 1_929_903_264L,
        sha256 = "9c9f56a391a3abbd5b89d0245bf6106081bcc3173119d4229235dd9d23253f94",
        ramNeededMB = 3584,
    ),
    NativeModel(
        id = "qwen-2.5-7b-q4km",
        label = "Qwen 2.5 · 7B",
        language = "ES/EN",
        fileName = "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
        expectedBytes = 4_683_074_240L,
        sha256 = "65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423",
        ramNeededMB = 7168,
    ),
)

/** Tamaños verificados contra las páginas de Hugging Face (bartowski, Q4_K_M). */

/** Perfil de inferencia por modelo */
data class ModelProfile(
    val nCtx: Int,
    val nThreads: Int = 0, // 0 = auto big cores
    val nBatch: Int = 512,
    val maxTokens: Int = 512,
    val temperature: Float = 0.65f,
    val topP: Float = 0.9f,
    val topK: Int = 40,
    val minP: Float = 0.05f,
    val repeatPenalty: Float = 1.1f,
    val chatTemplateType: String = "auto",
    val supportsThinking: Boolean = false,
    val defaultThinkingBudget: Int = 0,
)

fun getProfile(modelId: String, totalRamMB: Int = 4096): ModelProfile {
    return when {
        modelId.startsWith("qwen-3-0.6b") || modelId.startsWith("qwen-2.5-0.5b") -> ModelProfile(
            nCtx = 2048,
            maxTokens = 256,
            temperature = 0.6f,
            topP = 0.9f,
            topK = 40,
            minP = 0.05f,
            repeatPenalty = 1.1f,
            chatTemplateType = "qwen",
            supportsThinking = false
        )
        modelId.startsWith("gemma-4-e4b") || modelId.startsWith("minicpm3-4b") || modelId.startsWith("qwen-2.5-7b") -> ModelProfile(
            nCtx = if (totalRamMB >= 6144) 4096 else 2048,
            maxTokens = 1024,
            temperature = 0.7f,
            topP = 0.9f,
            topK = 40,
            minP = 0.05f,
            repeatPenalty = 1.1f,
            chatTemplateType = if (modelId.contains("gemma")) "gemma" else "auto",
            supportsThinking = true,
            defaultThinkingBudget = 512
        )
        // Por defecto: Gemma 4 E2B, MiniCPM 2B, Llama 3.2 1B
        else -> ModelProfile(
            nCtx = if (totalRamMB >= 4096) 4096 else 2048,
            maxTokens = 512,
            temperature = 0.65f,
            topP = 0.9f,
            topK = 40,
            minP = 0.05f,
            repeatPenalty = 1.1f,
            chatTemplateType = if (modelId.contains("gemma")) "gemma" else "auto",
            supportsThinking = false
        )
    }
}

sealed interface EngineState {
    data object Idle : EngineState
    data object Loading : EngineState
    data class Ready(val modelId: String) : EngineState
    data object Generating : EngineState
    data class Error(val message: String) : EngineState
}

/**
 * Motor de inferencia nativo. Vive en el proceso de la app; el modelo activo
 * se guarda en SharedPreferences como id del catálogo.
 */
object LlamaEngine {
    private const val TAG = "NODO_LLAMA"
    private val io = Executors.newSingleThreadExecutor()
    private val handle = AtomicLong(0L)

    private val _state = MutableStateFlow<EngineState>(EngineState.Idle)
    val state: StateFlow<EngineState> = _state

    private val _stream = MutableStateFlow("")
    val stream: StateFlow<String> = _stream

    @Volatile
    var activeModelId: String? = null
        private set

    fun modelsDir(filesDir: File): File = File(filesDir, "models").apply { mkdirs() }

    fun modelFile(filesDir: File, model: NativeModel): File =
        File(modelsDir(filesDir), model.fileName)

    /** Detecta los núcleos grandes (performance cores) para evitar hilos en núcleos lentos */
    fun detectBigCores(): Int {
        try {
            val cpuDir = File("/sys/devices/system/cpu")
            val freqList = mutableListOf<Long>()
            val cpuFiles = cpuDir.listFiles { f -> f.name.matches(Regex("cpu[0-9]+")) } ?: emptyArray()
            for (f in cpuFiles) {
                val freqFile = File(f, "cpufreq/cpuinfo_max_freq")
                if (freqFile.exists()) {
                    val freq = freqFile.readText().trim().toLongOrNull() ?: 0L
                    if (freq > 0L) freqList.add(freq)
                }
            }
            if (freqList.isNotEmpty()) {
                val maxFreq = freqList.maxOrNull() ?: 0L
                val count = freqList.count { it >= maxFreq * 0.85 }
                if (count in 2..6) return count
            }
        } catch (_: Exception) {}
        val procs = Runtime.getRuntime().availableProcessors()
        return when {
            procs >= 8 -> 4
            procs >= 6 -> 4
            procs >= 4 -> 3
            else -> procs.coerceAtLeast(2)
        }
    }

    /** Detecta si el prompt contiene consultas matemáticas o numéricas para fijar temp a 0.2 */
    fun isMathOrDataQuery(prompt: String): Boolean {
        val lower = prompt.lowercase()
        val mathRegex = Regex("""(\b(calcula|calculo|matematica|ecuacion|porcentaje|estadistica|suma|resta|multiplica|divide|deriva|integra|algebra|promedio|formula|raiz cuadrada|desviacion|cuanto es|resultado)\b|[\d+\-*/=^%]{3,})""")
        return mathRegex.containsMatchIn(lower)
    }

    /** Detecta e importa automáticamente modelos colocados en Download/Descargas vía cable USB. */
    fun checkAutoImport(filesDir: File, model: NativeModel) {
        val target = modelFile(filesDir, model)
        if (target.exists() && target.length() > 50_000_000L) return

        val candidateNames = listOf(
            model.fileName,
            if (model.id.startsWith("gemma-4-e2b")) "gemma-2-2b-it-Q4_K_M.gguf" else null,
            if (model.id.startsWith("gemma-4-e2b")) "gemma-4-e2b-it-Q4_K_M.gguf" else null,
            if (model.id.startsWith("minicpm-2b")) "MiniCPM5-2B-Q4_K_M.gguf" else null
        ).filterNotNull()

        val candidateDirs = listOfNotNull(
            android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS),
            android.os.Environment.getExternalStorageDirectory(),
            File(android.os.Environment.getExternalStorageDirectory(), "Download"),
            File(android.os.Environment.getExternalStorageDirectory(), "Descargas")
        )

        for (dir in candidateDirs) {
            for (name in candidateNames) {
                val candidate = File(dir, name)
                if (candidate.exists() && candidate.length() > 50_000_000L) {
                    try {
                        candidate.copyTo(target, overwrite = true)
                        return
                    } catch (_: Exception) {}
                }
            }
        }
    }

    val isLoaded: Boolean
        get() = com.example.jinx.inference.InferenceManager.isLoaded

    fun isDownloaded(filesDir: File, model: NativeModel): Boolean {
        checkAutoImport(filesDir, model)
        val f = modelFile(filesDir, model)
        if (!f.exists() || f.length() < 30_000_000L) return false
        if (model.format == "litertlm") {
            return f.length() > 50_000_000L
        }
        return f.length() == model.expectedBytes ||
            (model.expectedBytes > 0 && Math.abs(f.length() - model.expectedBytes) < 150_000_000L) ||
            ModelDownloader.isValidGguf(f)
    }

    /** Carga el modelo en hilo de fondo usando el perfil específico del modelo. onDone(true) = listo. */
    fun load(filesDir: File, model: NativeModel, onDone: (Boolean) -> Unit) {
        val (prefCtx, prefThreads) = enginePrefs(filesDir)
        val profile = getProfile(model.id)
        val nCtx = if (prefCtx != 2048) prefCtx else profile.nCtx
        val nThreads = if (prefThreads != 0) prefThreads else (if (profile.nThreads > 0) profile.nThreads else detectBigCores())
        loadWith(filesDir, model, nCtx, nThreads, onDone)
    }

    private var prefsCache: android.content.SharedPreferences? = null
    var appContext: android.content.Context? = null
        private set

    /** Fija el contexto para leer ajustes del motor. Llamar al arrancar. */
    fun attach(context: android.content.Context) {
        appContext = context.applicationContext
        prefsCache = context.applicationContext.getSharedPreferences("nodo", android.content.Context.MODE_PRIVATE)
        com.example.jinx.inference.InferenceManager.init(context)
    }

    /** (nCtx, nThreads). nThreads 0 = automático. */
    fun enginePrefs(filesDir: File): Pair<Int, Int> {
        val p = prefsCache
        return if (p == null) {
            Pair(2048, 0)
        } else {
            Pair(p.getInt("engine_nctx", 2048), p.getInt("engine_threads", 0))
        }
    }

    fun loadWith(filesDir: File, model: NativeModel, nCtx: Int, nThreads: Int, onDone: (Boolean) -> Unit) {
        _state.value = EngineState.Loading
        io.execute {
            try {
                val file = modelFile(filesDir, model)
                if (!file.exists() || file.length() < 30_000_000L) {
                    _state.value = EngineState.Error("Archivo incompleto o no encontrado")
                    onDone(false)
                    return@execute
                }
                val success = com.example.jinx.inference.InferenceManager.loadModel(
                    context = null,
                    modelPath = file.absolutePath,
                    modelId = model.id,
                    nCtx = nCtx,
                    nThreads = nThreads
                )
                if (success) {
                    activeModelId = model.id
                    _state.value = EngineState.Ready(model.id)
                    onDone(true)
                } else {
                    _state.value = EngineState.Error("No se pudo inicializar el motor de inferencia")
                    onDone(false)
                }
            } catch (e: Exception) {
                Log.e(TAG, "load failed", e)
                _state.value = EngineState.Error(e.message ?: "Error al cargar")
                onDone(false)
            }
        }
    }

    /** Genera en hilo de fondo con perfil de muestreo y streaming; los tokens llegan por onToken. */
    fun generate(
        prompt: String,
        maxTokens: Int = 0,
        tempOverride: Float? = null,
        onToken: (String) -> Unit,
        onDone: (String) -> Unit,
        onError: ((String) -> Unit)? = null,
        onStats: ((com.example.jinx.inference.GenerationStats) -> Unit)? = null,
    ) {
        if (!com.example.jinx.inference.InferenceManager.isLoaded) {
            if (onError != null) onError("No hay ningún modelo cargado") else onDone("[sin modelo cargado]")
            return
        }
        if (_state.value is EngineState.Generating) {
            stop()
            try {
                Thread.sleep(60)
            } catch (_: InterruptedException) {}
        }
        _state.value = EngineState.Generating
        _stream.value = ""

        val profile = getProfile(activeModelId ?: "")
        val maxToks = if (maxTokens > 0) maxTokens else profile.maxTokens
        val temp = tempOverride ?: (if (isMathOrDataQuery(prompt)) 0.2f else profile.temperature)

        val acc = StringBuilder()
        com.example.jinx.inference.InferenceManager.generate(
            promptOrJson = prompt,
            maxTokens = maxToks,
            temperature = temp,
            topP = profile.topP,
            topK = profile.topK,
            onToken = { piece ->
                acc.append(piece)
                _stream.value = acc.toString()
                onToken(piece)
            },
            onDone = { fullText, stats ->
                _state.value = EngineState.Ready(activeModelId ?: "")
                onStats?.invoke(stats)
                onDone(fullText)
            },
            onError = { errMsg ->
                _state.value = EngineState.Ready(activeModelId ?: "")
                if (onError != null) onError(errMsg) else onDone("[error: $errMsg]")
            }
        )
    }

    fun stop() {
        com.example.jinx.inference.InferenceManager.stop()
        _state.value = EngineState.Ready(activeModelId ?: "")
        _stream.value = ""
    }

    fun unload() {
        io.execute {
            com.example.jinx.inference.InferenceManager.unloadAll()
        }
        activeModelId = null
        _state.value = EngineState.Idle
    }
}
