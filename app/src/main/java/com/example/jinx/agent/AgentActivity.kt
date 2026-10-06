package com.example.jinx.agent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private val Signal = Color(0xFF00F5A0)
private val Ink = Color(0xFF07090E)

/** Pantalla Agente: el modelo ejecuta tareas en el teléfono con tu permiso. */
class AgentActivity : ComponentActivity() {

    private val exec = Executors.newSingleThreadExecutor()
    private val cancelled = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = androidx.compose.material3.darkColorScheme(primary = Signal, background = Ink, surface = Color(0xFF0D111B))) {
                Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
                    AgentScreen(
                        onBack = { finish() },
                        onRun = { task, onStep ->
                            cancelled.set(false)
                            exec.execute {
                                try {
                                    runAgent(this, task, onStep) { cancelled.get() }
                                } catch (e: Exception) {
                                    onStep(AgentStep(AgentStep.Kind.ERROR, e.message ?: "Error"))
                                }
                            }
                        },
                        onCancel = { cancelled.set(true) },
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        cancelled.set(true)
        exec.shutdownNow()
        super.onDestroy()
    }
}

@Composable
private fun AgentScreen(
    onBack: () -> Unit,
    onRun: (String, (AgentStep) -> Unit) -> Unit,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current
    var task by remember { mutableStateOf("") }
    var running by remember { mutableStateOf(false) }
    var permTick by remember { mutableStateOf(0) }
    val steps = remember { mutableStateListOf<AgentStep>() }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permTick++ }

    val missing = remember(permTick) {
        AGENT_PERMISSIONS.filter { (perm, _) -> !hasPermission(context, perm) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    0.0f to Color(0xFF00F5A0).copy(alpha = 0.06f),
                    0.6f to Color.Transparent,
                    center = Offset(200f, 0f),
                    radius = 900f,
                ),
            )
            .padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onBack) { Text("‹ Volver", color = Signal) }
            Text("AGENTE", color = Color.Gray, style = MaterialTheme.typography.labelSmall)
        }
        Text("Agente del teléfono", style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Text(
            "Pide tareas y el modelo usará las habilidades concedidas.",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray,
        )
        Spacer(Modifier.height(10.dp))

        if (missing.isNotEmpty()) {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF241A08))) {
                Column(Modifier.padding(12.dp)) {
                    Text("Habilidades bloqueadas por permiso:", color = Color(0xFFFFB800), style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.height(6.dp))
                    for ((perm, why) in missing) {
                        Text("• $why", color = Color(0xFFE2E8F0), style = MaterialTheme.typography.bodySmall)
                    }
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { launcher.launch(missing.map { it.first }.toTypedArray()) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFB800), contentColor = Ink),
                    ) { Text("Conceder permisos") }
                }
            }
            Spacer(Modifier.height(10.dp))
        }

        OutlinedTextField(
            value = task,
            onValueChange = { task = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Ej.: enciende la linterna y dime la hora") },
            maxLines = 3,
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    if (task.isBlank() || running) return@Button
                    steps.clear()
                    running = true
                    onRun(task) { step ->
                        (context as? AgentActivity)?.runOnUiThread {
                            steps.add(step)
                            if (step.kind == AgentStep.Kind.FINAL || step.kind == AgentStep.Kind.ERROR) {
                                running = false
                            }
                        }
                    }
                },
                enabled = !running,
                colors = ButtonDefaults.buttonColors(containerColor = Signal, contentColor = Ink),
            ) { Text(if (running) "Trabajando…" else "Ejecutar") }
            if (running) {
                OutlinedButton(onClick = {
                    onCancel()
                    running = false
                }) { Text("Detener") }
            }
        }
        Spacer(Modifier.height(10.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxSize()) {
            items(steps) { s ->
                val color = when (s.kind) {
                    AgentStep.Kind.TOOL -> Signal
                    AgentStep.Kind.RESULT -> Color(0xFF57E6FF)
                    AgentStep.Kind.ERROR -> Color(0xFFF87171)
                    AgentStep.Kind.FINAL -> Color.White
                    AgentStep.Kind.THINKING -> Color.Gray
                }
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0D111B).copy(alpha = 0.72f)),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                ) {
                    Text(s.text, color = color, modifier = Modifier.padding(10.dp), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
