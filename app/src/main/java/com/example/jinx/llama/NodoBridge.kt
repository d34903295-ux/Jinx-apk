package com.example.jinx.llama

import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import android.webkit.JavascriptInterface
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

/**
 * Puente JS -> nativo. Toda la gestión de modelos GGUF vive aquí:
 * descarga reanudable, estados, activación y generación con streaming.
 * [emitJs] debe ejecutarse en el hilo UI (evaluateJavascript).
 */
class NodoBridge(
    private val context: Context,
    private val emitJs: (String) -> Unit,
) {
    init {
        LlamaEngine.attach(context)
    }
    private val exec = Executors.newCachedThreadPool()
    private var service: DownloadService? = null

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as DownloadService.LocalBinder).service()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
        }
    }

    private fun ensureBound() {
        if (service == null) {
            try {
                context.bindService(
                    Intent(context, DownloadService::class.java),
                    conn,
                    Context.BIND_AUTO_CREATE,
                )
            } catch (e: Exception) {
                Log.e(TAG, "bind failed", e)
            }
        }
    }

    private fun prefs() = context.getSharedPreferences("nodo", Context.MODE_PRIVATE)

    // ---------- navegación ----------

    @JavascriptInterface
    fun openModels() {
        context.startActivity(
            Intent(context, ModelsActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }

    @JavascriptInterface
    fun openAgent() {
        context.startActivity(
            Intent(context, com.example.jinx.agent.AgentActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }

    // ---------- modelos ----------

    @JavascriptInterface
    fun activeNativeModel(): String = prefs().getString("active_native_model", "") ?: ""

    @JavascriptInterface
    fun modelsJson(): String {
        ensureBound()
        val arr = JSONArray()
        for (m in NATIVE_MODELS) {
            val o = JSONObject()
            o.put("id", m.id)
            o.put("label", m.label)
            o.put("language", m.language)
            o.put("fileName", m.fileName)
            o.put("sizeMB", m.expectedBytes / 1048576)
            o.put("ramMB", m.ramNeededMB)
            o.put("recommended", m.recommended)
            val st = service?.stateOf(context.filesDir, m) ?: localStateOf(m)
            when (st) {
                is DownloadState.Done -> {
                    o.put("state", if (activeNativeModel() == m.id) "active" else "ready")
                    o.put("downloadedMB", m.expectedBytes / 1048576)
                }
                is DownloadState.Running -> {
                    o.put("state", "downloading")
                    o.put("downloadedMB", st.progress.downloadedBytes / 1048576)
                    o.put("speedMBs", st.progress.bytesPerSecond / 1048576.0)
                    o.put("etaSec", st.progress.etaSeconds)
                }
                is DownloadState.Paused -> {
                    o.put("state", "paused")
                    o.put("downloadedMB", st.downloadedBytes / 1048576)
                }
                is DownloadState.Verifying -> {
                    o.put("state", "downloading")
                    o.put("downloadedMB", st.downloadedBytes / 1048576)
                    o.put("verifying", true)
                }
                is DownloadState.Error -> {
                    o.put("state", "error")
                    o.put("error", st.message)
                    o.put("downloadedMB", downloadedSoFar(m) / 1048576)
                }
                is DownloadState.Idle -> {
                    o.put("state", if (downloadedSoFar(m) > 0) "paused" else "none")
                    o.put("downloadedMB", downloadedSoFar(m) / 1048576)
                }
            }
            o.put("totalMB", m.expectedBytes / 1048576)
            arr.put(o)
        }
        return arr.toString()
    }

    private fun downloadedSoFar(m: NativeModel): Long {
        val part = File(LlamaEngine.modelsDir(context.filesDir), m.fileName + ".part")
        return if (part.exists()) part.length() else 0L
    }

    private fun localStateOf(m: NativeModel): DownloadState {
        if (LlamaEngine.isDownloaded(context.filesDir, m)) {
            return DownloadState.Done(LlamaEngine.modelFile(context.filesDir, m))
        }
        val soFar = downloadedSoFar(m)
        if (soFar > 0) return DownloadState.Paused(soFar, m.expectedBytes)
        return DownloadState.Idle
    }

    @JavascriptInterface
    fun startDownload(id: String): String {
        val m = NATIVE_MODELS.firstOrNull { it.id == id } ?: return "unknown"
        val free = context.filesDir.usableSpace
        if (!LlamaEngine.isDownloaded(context.filesDir, m) &&
            free < m.expectedBytes - downloadedSoFar(m) + 500L * 1024 * 1024
        ) {
            return "nospace"
        }
        ensureBound()
        DownloadService.start(context, id)
        return "ok"
    }

    @JavascriptInterface
    fun pauseDownload(): String {
        service?.onPauseCommand()
        return "ok"
    }

    @JavascriptInterface
    fun resumeDownload(id: String): String = startDownload(id)

    @JavascriptInterface
    fun cancelDownload(): String {
        service?.cancelCurrent()
        val cur = service?.currentModel()
        if (cur != null) {
            File(LlamaEngine.modelsDir(context.filesDir), cur.fileName + ".part").delete()
        }
        context.stopService(Intent(context, DownloadService::class.java))
        return "ok"
    }

    @JavascriptInterface
    fun deleteModel(id: String): String {
        val m = NATIVE_MODELS.firstOrNull { it.id == id } ?: return "unknown"
        if (service?.currentModel()?.id == id) {
            service?.cancelCurrent()
            context.stopService(Intent(context, DownloadService::class.java))
        }
        LlamaEngine.modelFile(context.filesDir, m).delete()
        File(LlamaEngine.modelsDir(context.filesDir), m.fileName + ".part").delete()
        if (activeNativeModel() == id) {
            prefs().edit().remove("active_native_model").apply()
            LlamaEngine.unload()
        }
        return "ok"
    }

    @JavascriptInterface
    fun setActiveModel(id: String): String {
        val m = NATIVE_MODELS.firstOrNull { it.id == id } ?: return "unknown"
        if (!LlamaEngine.isDownloaded(context.filesDir, m)) return "not-downloaded"
        prefs().edit().putString("active_native_model", id).apply()
        return "ok"
    }

    // ---------- generación ----------

    private fun emitCb(cbId: String, kind: String, text: String) {
        val js = "window.__nodoCb&&window.__nodoCb(" +
            JSONObject.quote(cbId) + "," +
            JSONObject.quote(kind) + "," +
            JSONObject.quote(text) + ")"
        emitJs(js)
    }

    /**
     * Genera en segundo plano. Eventos al JS: start | token | done | error.
     * Carga el modelo activo si aún no está en memoria.
     */
    @JavascriptInterface
    fun generate(prompt: String, maxTokens: Int, cbId: String): String {
        val id = activeNativeModel()
        val m = NATIVE_MODELS.firstOrNull { it.id == id }
        if (m == null) return "no-model"
        exec.execute {
            try {
                emitCb(cbId, "start", "")
                val ready = LlamaEngine.state.value
                if (ready !is EngineState.Ready || LlamaEngine.activeModelId != id) {
                    val latch = java.util.concurrent.CountDownLatch(1)
                    var ok = false
                    LlamaEngine.load(context.filesDir, m) { done ->
                        ok = done
                        latch.countDown()
                    }
                    latch.await()
                    if (!ok) {
                        emitCb(cbId, "error", "No se pudo cargar el modelo")
                        return@execute
                    }
                }
                LlamaEngine.generate(
                    prompt,
                    maxTokens,
                    onToken = { full -> emitCb(cbId, "token", full) },
                    onDone = { full -> emitCb(cbId, "done", full) },
                )
            } catch (e: Exception) {
                Log.e(TAG, "generate failed", e)
                emitCb(cbId, "error", e.message ?: "Error")
            }
        }
        return "ok"
    }

    @JavascriptInterface
    fun stopGenerate(): String {
        LlamaEngine.stop()
        return "ok"
    }

    // ---------- agente ----------

    private val agentCancelled = java.util.concurrent.atomic.AtomicBoolean(false)

    /**
     * Ejecuta una tarea con el bucle ReAct (herramientas del teléfono).
     * Eventos: start | step | done | error.
     */
    @JavascriptInterface
    fun agentTask(task: String, cbId: String): String {
        agentCancelled.set(false)
        exec.execute {
            try {
                emitCb(cbId, "start", "")
                val res = com.example.jinx.agent.runAgent(
                    context,
                    task,
                    onStep = { step -> emitCb(cbId, "step", step.kind.name + ": " + step.text) },
                    isCancelled = { agentCancelled.get() },
                )
                emitCb(cbId, "done", res)
            } catch (e: Exception) {
                Log.e(TAG, "agent failed", e)
                emitCb(cbId, "error", e.message ?: "Error")
            }
        }
        return "ok"
    }

    @JavascriptInterface
    fun stopAgent(): String {
        agentCancelled.set(true)
        LlamaEngine.stop()
        return "ok"
    }

    // ---------- dispositivo ----------

    @JavascriptInterface
    fun freeSpaceMB(): Long = context.filesDir.usableSpace / 1048576

    @JavascriptInterface
    fun totalRamMB(): Long {
        val am = context.getSystemService(ActivityManager::class.java)
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return info.totalMem / 1048576
    }

    /** ¿La app está exenta de optimización de batería? (descargas fiables). */
    @JavascriptInterface
    fun isIgnoringBattery(): Boolean {
        val pm = context.getSystemService(PowerManager::class.java) ?: return false
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** Abre el diálogo del sistema para eximir a NODO de optimización. */
    @JavascriptInterface
    fun requestBatteryExemption(): String {
        return try {
            if (isIgnoringBattery()) {
                "already"
            } else {
                val intent = Intent(
                    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    android.net.Uri.parse("package:${context.packageName}"),
                ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                context.startActivity(intent)
                "ok"
            }
        } catch (e: Exception) {
            Log.e(TAG, "battery exemption failed", e)
            "error"
        }
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean =
        context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    @JavascriptInterface
    fun hasCameraPermission(): Boolean =
        context.checkSelfPermission(android.Manifest.permission.CAMERA) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    /** Abre los ajustes del sistema de la app (permisos, batería, notificaciones). */
    @JavascriptInterface
    fun openAppSettings(): String {
        return try {
            val intent = Intent(
                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                android.net.Uri.parse("package:${context.packageName}"),
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            context.startActivity(intent)
            "ok"
        } catch (e: Exception) {
            Log.e(TAG, "openAppSettings failed", e)
            "error"
        }
    }

    /** Texto compartido desde otra app (Compartir → NODO). Lo consume una vez. */
    @JavascriptInterface
    fun consumeSharedText(): String {
        val t = com.example.jinx.MainActivity.pendingSharedText
        com.example.jinx.MainActivity.pendingSharedText = null
        return t ?: ""
    }

    /** Comparte texto con otras apps (chooser del sistema). */
    @JavascriptInterface
    fun shareText(title: String, text: String): String {
        return try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, text)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(
                Intent.createChooser(intent, title).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
            "ok"
        } catch (e: Exception) {
            Log.e(TAG, "share failed", e)
            "error"
        }
    }

    /** Ajustes del motor: "nCtx,threads" (threads 0 = auto). */
    @JavascriptInterface
    fun getEnginePrefs(): String {
        val (nCtx, nThreads) = LlamaEngine.enginePrefs(context.filesDir)
        return "$nCtx,$nThreads"
    }

    @JavascriptInterface
    fun setEnginePrefs(nCtx: Int, nThreads: Int): String {
        val c = nCtx.coerceIn(1024, 4096)
        val t = nThreads.coerceIn(0, 8)
        prefs().edit().putInt("engine_nctx", c).putInt("engine_threads", t).apply()
        LlamaEngine.attach(context)
        // Se aplica la próxima vez que se cargue el modelo.
        return "ok"
    }

    /** Estado del modelo de voz: ready | downloading | none. */
    @JavascriptInterface
    fun voskState(): String {
        val filesDir = context.filesDir
        if (com.example.jinx.speech.VoskManager.isReady(filesDir)) return "ready"
        val zip = com.example.jinx.speech.VoskManager.downloadedZip(filesDir)
        if (zip.exists() && zip.length() > 0) return "downloading"
        return "none"
    }

    /** Descarga el modelo de voz en segundo plano (con notificación). */
    @JavascriptInterface
    fun downloadVoskModel(): String {
        DownloadService.start(context, com.example.jinx.speech.VOSK_MODEL.id)
        return "ok"
    }

    /** ¿Permiso de micrófono concedido? */
    @JavascriptInterface
    fun hasMicPermission(): Boolean {
        return context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun emitDict(cbId: String, kind: String, text: String) {
        val js = "window.__nodoDictation&&window.__nodoDictation(" +
            JSONObject.quote(cbId) + "," +
            JSONObject.quote(kind) + "," +
            JSONObject.quote(text) + ")"
        emitJs(js)
    }

    /**
     * Inicia el dictado. Pide el permiso de micrófono si falta.
     * Eventos: partial | final | error.
     */
    @JavascriptInterface
    fun startDictation(cbId: String): String {
        val activity = context as? com.example.jinx.MainActivity
        if (activity == null) {
            emitDict(cbId, "error", "Sin actividad")
            return "error"
        }
        if (!com.example.jinx.speech.VoskManager.isReady(context.filesDir)) {
            emitDict(cbId, "need-model", "")
            return "need-model"
        }
        activity.requestMic {
            com.example.jinx.speech.VoskManager.start(
                context.filesDir,
                object : com.example.jinx.speech.VoskManager.Listener {
                    override fun onPartial(text: String) = emitDict(cbId, "partial", text)
                    override fun onFinal(text: String) = emitDict(cbId, "final", text)
                    override fun onError(message: String) = emitDict(cbId, "error", message)
                },
            )
            emitDict(cbId, "start", "")
        }
        return "ok"
    }

    @JavascriptInterface
    fun stopDictation(): String {
        com.example.jinx.speech.VoskManager.stop()
        return "ok"
    }

    companion object {
        private const val TAG = "NODO_BRIDGE"
    }
}
