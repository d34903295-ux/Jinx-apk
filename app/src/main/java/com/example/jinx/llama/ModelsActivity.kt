package com.example.jinx.llama

import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow

private val Signal = Color(0xFF00F5A0)
private val Ink = Color(0xFF07090E)

/** Pantalla Modelos: descargar, pausar, reanudar, eliminar, usar y probar. */
class ModelsActivity : ComponentActivity() {

    private val states = MutableStateFlow<Map<String, DownloadState>>(emptyMap())
    private var service: DownloadService? = null

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as DownloadService.LocalBinder).service()
            service?.listener = { refresh() }
            refresh()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        LlamaEngine.attach(this)
        setContent {
            MaterialTheme(colorScheme = darkJinx()) {
                Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
                    GlassBackground {
                        ModelsScreen(
                        filesDir = filesDir,
                        statesFlow = states,
                        onDownload = { m -> DownloadService.start(this, m.id); refreshSoon() },
                        onPause = { service?.let { (it as DownloadService).onPauseCommand() } ?: refresh() },
                        onResume = { m -> DownloadService.start(this, m.id); refreshSoon() },
                        onDelete = { m -> deleteModel(m); refresh() },
                        onUse = { m -> useModel(m) },
                        onBack = { finish() },
                    )
                }
            }
        }
    }
    }

    /** Fondo Liquid: glows radiales volt/cian sobre tinta. */
    @Composable
    private fun GlassBackground(content: @Composable () -> Unit) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    androidx.compose.ui.graphics.Brush.radialGradient(
                        0.0f to Color(0xFF00F5A0).copy(alpha = 0.07f),
                        0.6f to Color.Transparent,
                        center = Offset(200f, 0f),
                        radius = 900f,
                    ),
                ),
        ) {
            content()
        }
    }

    override fun onStart() {
        super.onStart()
        bindService(Intent(this, DownloadService::class.java), conn, Context.BIND_AUTO_CREATE)
        refresh()
    }

    override fun onStop() {
        try {
            unbindService(conn)
        } catch (_: Exception) {
        }
        service = null
        super.onStop()
    }

    private fun refreshSoon() {
        window.decorView.postDelayed({ refresh() }, 800)
    }

    private fun refresh() {
        val map = NATIVE_MODELS.associate { m ->
            m.id to (service?.stateOf(filesDir, m) ?: localStateOf(m))
        }
        states.value = map
    }

    private fun localStateOf(m: NativeModel): DownloadState {
        if (LlamaEngine.isDownloaded(filesDir, m)) return DownloadState.Done(LlamaEngine.modelFile(filesDir, m))
        val part = File(LlamaEngine.modelsDir(filesDir), m.fileName + ".part")
        if (part.exists() && part.length() > 0) return DownloadState.Paused(part.length(), m.expectedBytes)
        return DownloadState.Idle
    }

    private fun deleteModel(m: NativeModel) {
        service?.let {
            // Si se está descargando este modelo, cancelarlo.
            if (it.currentModel()?.id == m.id) it.cancelCurrent()
        }
        LlamaEngine.modelFile(filesDir, m).delete()
        File(LlamaEngine.modelsDir(filesDir), m.fileName + ".part").delete()
        val prefs = getSharedPreferences("nodo", Context.MODE_PRIVATE)
        if (prefs.getString("active_native_model", null) == m.id) {
            prefs.edit().remove("active_native_model").apply()
            LlamaEngine.unload()
        }
        refresh()
    }

    private fun useModel(m: NativeModel) {
        if (!LlamaEngine.isDownloaded(filesDir, m)) return
        getSharedPreferences("nodo", Context.MODE_PRIVATE).edit()
            .putString("active_native_model", m.id).apply()
        LlamaEngine.load(filesDir, m) { refresh() }
        refresh()
    }
}

private fun darkJinx() = androidx.compose.material3.darkColorScheme(
    primary = Signal,
    background = Ink,
    surface = Color(0xFF0D111B),
)

@Composable
private fun ModelsScreen(
    filesDir: File,
    statesFlow: MutableStateFlow<Map<String, DownloadState>>,
    onDownload: (NativeModel) -> Unit,
    onPause: () -> Unit,
    onResume: (NativeModel) -> Unit,
    onDelete: (NativeModel) -> Unit,
    onUse: (NativeModel) -> Unit,
    onBack: () -> Unit,
) {
    val states by statesFlow.collectAsState()
    val freeGB = remember { filesDir.usableSpace / 1073741824.0 }
    var testing by remember { mutableStateOf<NativeModel?>(null) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onBack) { Text("‹ Volver", color = Signal) }
            Text("Libre: %.1f GB".format(freeGB), color = Color.Gray)
        }
        Text("Modelos", style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Text(
            "Se descargan una sola vez y funcionan sin internet.",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray,
        )
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(NATIVE_MODELS) { m ->
                ModelCard(
                    model = m,
                    state = states[m.id] ?: DownloadState.Idle,
                    filesDir = filesDir,
                    onDownload = { onDownload(m) },
                    onPause = onPause,
                    onResume = { onResume(m) },
                    onDelete = { onDelete(m) },
                    onUse = { onUse(m) },
                    onTest = { testing = m },
                )
            }
        }
    }

    testing?.let { m ->
        TestDialog(model = m, filesDir = filesDir, onClose = { testing = null })
    }
}

@Composable
private fun ModelCard(
    model: NativeModel,
    state: DownloadState,
    filesDir: File,
    onDownload: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onDelete: () -> Unit,
    onUse: () -> Unit,
    onTest: () -> Unit,
) {
    val tooHeavy = model.ramNeededMB > 6144
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0D111B).copy(alpha = 0.72f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(model.label, color = Color.White, style = MaterialTheme.typography.titleMedium)
                StatusChip(state, model, filesDir)
            }
            Text(
                "${model.fileName} · ${model.expectedBytes / 1048576} MB · RAM ~${model.ramNeededMB / 1024} GB · ${model.language}",
                color = Color.Gray,
                style = MaterialTheme.typography.bodySmall,
            )
            if (tooHeavy) {
                Text("Aviso: muy pesado para este dispositivo.", color = Color(0xFFFFB800))
            }
            Spacer(Modifier.height(10.dp))
            if (state is DownloadState.Running) {
                val p = state.progress
                LinearProgressIndicator(
                    progress = { p.fraction },
                    modifier = Modifier.fillMaxWidth(),
                    color = Signal,
                )
                Text(
                    "${p.downloadedBytes / 1048576}/${p.totalBytes / 1048576} MB · %.1f MB/s".format(p.bytesPerSecond / 1048576.0) +
                        if (p.etaSeconds >= 0) " · ${p.etaSeconds / 60}m ${p.etaSeconds % 60}s" else "",
                    color = Signal,
                    style = MaterialTheme.typography.bodySmall,
                )
                Spacer(Modifier.height(8.dp))
            }
            if (state is DownloadState.Paused) {
                Text(
                    "En pausa en ${state.downloadedBytes / 1048576}/${state.totalBytes / 1048576} MB",
                    color = Color.Gray,
                    style = MaterialTheme.typography.bodySmall,
                )
                Spacer(Modifier.height(8.dp))
            }
            if (state is DownloadState.Error) {
                Text("Error: ${state.message}", color = Color(0xFFF87171))
                Spacer(Modifier.height(8.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                when (state) {
                    is DownloadState.Idle -> Button(onClick = onDownload) { Text("Descargar") }
                    is DownloadState.Paused -> {
                        Button(onClick = onResume) { Text("Reanudar") }
                        OutlinedButton(onClick = onDelete) { Text("Eliminar") }
                    }
                    is DownloadState.Running -> {
                        OutlinedButton(onClick = onPause) { Text("Pausar") }
                    }
                    is DownloadState.Done -> {
                        Button(
                            onClick = onUse,
                            colors = ButtonDefaults.buttonColors(containerColor = Signal, contentColor = Ink),
                        ) { Text("Usar este modelo") }
                        OutlinedButton(onClick = onTest) { Text("Probar") }
                        OutlinedButton(onClick = onDelete) { Text("Eliminar") }
                    }
                    is DownloadState.Error -> {
                        Button(onClick = onResume) { Text("Reintentar") }
                        OutlinedButton(onClick = onDelete) { Text("Eliminar") }
                    }
                    is DownloadState.Verifying -> {
                        Text("Verificando…", color = Color.Gray)
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusChip(state: DownloadState, model: NativeModel, filesDir: File) {
    val prefs = LocalContext.current.getSharedPreferences("nodo", Context.MODE_PRIVATE)
    val active = prefs.getString("active_native_model", null) == model.id
    val text = when {
        active -> "ACTIVO"
        state is DownloadState.Done -> "LISTO"
        state is DownloadState.Running -> "DESCARGANDO"
        state is DownloadState.Paused -> "PAUSADO"
        state is DownloadState.Error -> "ERROR"
        else -> "NO DESCARGADO"
    }
    val color = when {
        active || state is DownloadState.Done -> Signal
        state is DownloadState.Error -> Color(0xFFF87171)
        else -> Color.Gray
    }
    Text(text, color = color, style = MaterialTheme.typography.labelSmall)
}

@Composable
private fun ThinkingDots() {
    val t = rememberInfiniteTransition(label = "dots")
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (i in 0..2) {
            val dy by t.animateFloat(
                initialValue = 0f,
                targetValue = -6f,
                animationSpec = infiniteRepeatable(
                    animation = tween(400, easing = FastOutSlowInEasing, delayMillis = i * 130),
                    repeatMode = RepeatMode.Reverse,
                ),
                label = "dot$i",
            )
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .offset(y = dy.dp)
                    .background(Signal, CircleShape),
            )
        }
    }
}

@Composable
private fun TestDialog(model: NativeModel, filesDir: File, onClose: () -> Unit) {
    var output by remember { mutableStateOf("Cargando modelo…") }
    var loading by remember { mutableStateOf(true) }

    DisposableEffect(model.id) {
        var cancelled = false
        LlamaEngine.load(filesDir, model) { ok ->
            if (cancelled) return@load
            if (!ok) {
                output = "No se pudo cargar el modelo."
                loading = false
                return@load
            }
            LlamaEngine.generate(
                "Di hola y preséntate en una frase.",
                128,
                onToken = { full -> if (!cancelled) output = full },
                onDone = { full ->
                    if (!cancelled) {
                        output = full.ifBlank { "(sin respuesta)" }
                        loading = false
                    }
                },
            )
        }
        onDispose {
            cancelled = true
            LlamaEngine.stop()
        }
    }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onClose,
        title = { Text("Probar · ${model.label}", color = Color.White) },
        text = {
            Column {
                if (loading && output == "Cargando modelo…") {
                    ThinkingDots()
                    Spacer(Modifier.height(8.dp))
                }
                Text(output.ifBlank { "…" }, color = Color(0xFFE2E8F0))
            }
        },
        confirmButton = {
            TextButton(onClick = onClose) { Text("Cerrar", color = Signal) }
        },
    )
}
