package com.example.jinx.llama

import android.util.Log
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Catálogo de modelos GGUF. Solo HTTPS de huggingface.co. */
data class NativeModel(
    val id: String,
    val label: String,
    val language: String,
    val fileName: String,
    val url: String,
    /** Tamaño esperado en bytes (verificación de integridad). */
    val expectedBytes: Long,
    val ramNeededMB: Int,
    val recommended: Boolean = false,
)

val NATIVE_MODELS: List<NativeModel> = listOf(
    NativeModel(
        id = "llama-3.2-1b-q4km",
        label = "Llama 3.2 · 1B",
        language = "ES/EN",
        fileName = "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        expectedBytes = 807_694_464L,
        ramNeededMB = 2048,
        recommended = true,
    ),
    NativeModel(
        id = "qwen-2.5-1.5b-q4km",
        label = "Qwen 2.5 · 1.5B",
        language = "ES/EN",
        fileName = "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        expectedBytes = 986_048_768L,
        ramNeededMB = 2560,
    ),
    NativeModel(
        id = "qwen-2.5-3b-q4km",
        label = "Qwen 2.5 · 3B",
        language = "ES/EN",
        fileName = "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
        url = "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
        expectedBytes = 1_929_903_264L,
        ramNeededMB = 3584,
    ),
)

/** Tamaños verificados contra las páginas de Hugging Face (bartowski, Q4_K_M). */

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

    fun isDownloaded(filesDir: File, model: NativeModel): Boolean {
        val f = modelFile(filesDir, model)
        return f.exists() && f.length() == model.expectedBytes
    }

    /** Carga el modelo en hilo de fondo. onDone(true) = listo. */
    fun load(filesDir: File, model: NativeModel, nCtx: Int = 2048, onDone: (Boolean) -> Unit) {
        if (!LlamaBridge.ensureLoaded()) {
            _state.value = EngineState.Error("Motor nativo no disponible en este dispositivo")
            onDone(false)
            return
        }
        _state.value = EngineState.Loading
        io.execute {
            try {
                freeInternal()
                val file = modelFile(filesDir, model)
                if (!file.exists() || file.length() != model.expectedBytes) {
                    _state.value = EngineState.Error("Archivo incompleto, descárgalo de nuevo")
                    onDone(false)
                    return@execute
                }
                val h = LlamaBridge.initModel(file.absolutePath, nCtx)
                if (h == 0L) {
                    _state.value = EngineState.Error("No se pudo cargar el modelo (RAM insuficiente?)")
                    onDone(false)
                    return@execute
                }
                handle.set(h)
                activeModelId = model.id
                _state.value = EngineState.Ready(model.id)
                onDone(true)
            } catch (e: Exception) {
                Log.e(TAG, "load failed", e)
                _state.value = EngineState.Error(e.message ?: "Error al cargar")
                onDone(false)
            }
        }
    }

    /** Genera en hilo de fondo; los tokens llegan por onToken. */
    fun generate(prompt: String, maxTokens: Int = 512, onToken: (String) -> Unit, onDone: (String) -> Unit) {
        val h = handle.get()
        if (h == 0L) {
            onDone("[sin modelo cargado]")
            return
        }
        _state.value = EngineState.Generating
        _stream.value = ""
        val acc = StringBuilder()
        io.execute {
            try {
                LlamaBridge.generate(h, prompt, maxTokens, object : LlamaBridge.GenerateCallback {
                    override fun onToken(piece: String) {
                        acc.append(piece)
                        _stream.value = acc.toString()
                        onToken(acc.toString())
                    }

                    override fun onDone(fullText: String) {
                        _state.value = EngineState.Ready(activeModelId ?: "")
                        onDone(fullText)
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "generate failed", e)
                _state.value = EngineState.Ready(activeModelId ?: "")
                onDone("[error: ${e.message}]")
            }
        }
    }

    fun stop() {
        val h = handle.get()
        if (h != 0L) {
            try {
                LlamaBridge.stop(h)
            } catch (e: Exception) {
                Log.e(TAG, "stop failed", e)
            }
        }
    }

    fun unload() {
        io.execute { freeInternal() }
        activeModelId = null
        _state.value = EngineState.Idle
    }

    private fun freeInternal() {
        val h = handle.getAndSet(0L)
        if (h != 0L) {
            try {
                LlamaBridge.free(h)
            } catch (e: Exception) {
                Log.e(TAG, "free failed", e)
            }
        }
    }
}
