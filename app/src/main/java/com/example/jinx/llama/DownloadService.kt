package com.example.jinx.llama

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.roundToInt

/**
 * Descargas en segundo plano aunque la app se minimice.
 * Acciones: pausar, reanudar y cancelar desde la notificación.
 */
class DownloadService : Service() {

    companion object {
        const val CHANNEL_ID = "nodo_downloads"
        const val NOTIF_ID = 41
        const val EXTRA_MODEL_ID = "model_id"
        const val ACTION_START = "com.example.jinx.llama.START"
        const val ACTION_PAUSE = "com.example.jinx.llama.PAUSE"
        const val ACTION_RESUME = "com.example.jinx.llama.RESUME"
        const val ACTION_CANCEL = "com.example.jinx.llama.CANCEL"

        fun start(context: Context, modelId: String) {
            val i = Intent(context, DownloadService::class.java).setAction(ACTION_START)
            i.putExtra(EXTRA_MODEL_ID, modelId)
            context.startForegroundService(i)
        }
    }

    private val binder = LocalBinder()
    private val exec = Executors.newSingleThreadExecutor()
    private var downloader: ModelDownloader? = null
    private var currentModel: NativeModel? = null

    var listener: ((DownloadState) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun service(): DownloadService = this@DownloadService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Descargas de modelos", NotificationManager.IMPORTANCE_LOW)
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val id = intent.getStringExtra(EXTRA_MODEL_ID) ?: return START_NOT_STICKY
                val model = NATIVE_MODELS.firstOrNull { it.id == id } ?: return START_NOT_STICKY
                startDownload(model)
            }
            ACTION_PAUSE -> downloader?.pause()
            ACTION_RESUME -> currentModel?.let { resumeDownload(it) }
            ACTION_CANCEL -> {
                downloader?.cancel()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun notifyFor(state: DownloadState, model: NativeModel) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIF_ID, buildNotification(state, model))
    }

    private fun actionIntent(action: String): PendingIntent {
        val i = Intent(this, DownloadService::class.java).setAction(action)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getService(this, action.hashCode(), i, flags)
    }

    private fun buildNotification(state: DownloadState, model: NativeModel): Notification {
        val b = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("NODO · ${model.label}")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
        when (state) {
            is DownloadState.Running -> {
                val p = state.progress
                val mb = p.downloadedBytes / 1048576
                val total = p.totalBytes / 1048576
                val speed = "%.1f MB/s".format(p.bytesPerSecond / 1048576.0)
                val eta = if (p.etaSeconds >= 0) " · quedan ${p.etaSeconds / 60}m ${p.etaSeconds % 60}s" else ""
                b.setContentText("$mb/$total MB · $speed$eta")
                    .setProgress(100, (p.fraction * 100).roundToInt(), false)
                    .addAction(android.R.drawable.ic_media_pause, "Pausar", actionIntent(ACTION_PAUSE))
                    .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancelar", actionIntent(ACTION_CANCEL))
            }
            is DownloadState.Paused -> {
                b.setContentText("En pausa · ${state.downloadedBytes / 1048576}/${state.totalBytes / 1048576} MB")
                    .addAction(android.R.drawable.ic_media_play, "Reanudar", actionIntent(ACTION_RESUME))
                    .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancelar", actionIntent(ACTION_CANCEL))
            }
            is DownloadState.Done -> {
                b.setContentText("Descarga completa y verificada")
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setOngoing(false)
                    .setProgress(0, 0, false)
            }
            is DownloadState.Error -> {
                b.setContentText("Error: ${state.message}")
                    .setOngoing(false)
                    .setProgress(0, 0, false)
            }
            else -> {
                b.setContentText("Preparando…")
            }
        }
        return b.build()
    }

    private fun startDownload(model: NativeModel) {
        // Espacio libre: exigir modelo + 500 MB de margen.
        val free = filesDir.usableSpace
        if (free < model.expectedBytes + 500L * 1024 * 1024) {
            val need = (model.expectedBytes + 500L * 1024 * 1024 - free) / 1048576
            listener?.invoke(DownloadState.Error("Faltan $need MB libres"))
            stopSelf()
            return
        }
        resumeDownload(model)
    }

    private fun resumeDownload(model: NativeModel) {
        currentModel = model
        val dl = ModelDownloader()
        downloader = dl
        dl.onState = { s ->
            listener?.invoke(s)
            notifyFor(s, model)
            if (s is DownloadState.Done || s is DownloadState.Error) {
                stopForeground(STOP_FOREGROUND_DETACH)
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIF_ID,
                buildNotification(DownloadState.Idle, model),
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIF_ID, buildNotification(DownloadState.Idle, model))
        }
        exec.execute {
            dl.download(model, LlamaEngine.modelsDir(filesDir))
            stopSelf()
        }
    }

    fun currentState(): DownloadState = downloader?.state ?: DownloadState.Idle
    fun currentModel(): NativeModel? = currentModel

    /** Pausar la descarga en curso (conserva lo descargado). */
    fun onPauseCommand() {
        downloader?.pause()
    }

    /** Cancelar la descarga en curso. */
    fun cancelCurrent() {
        downloader?.cancel()
    }

    fun stateOf(filesDir: File, model: NativeModel): DownloadState {
        if (currentModel?.id == model.id) return currentState()
        if (LlamaEngine.isDownloaded(filesDir, model)) {
            return DownloadState.Done(LlamaEngine.modelFile(filesDir, model))
        }
        val part = File(LlamaEngine.modelsDir(filesDir), model.fileName + ".part")
        if (part.exists() && part.length() > 0) {
            return DownloadState.Paused(part.length(), model.expectedBytes)
        }
        return DownloadState.Idle
    }

    override fun onDestroy() {
        downloader?.cancel()
        exec.shutdownNow()
        super.onDestroy()
    }
}
