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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
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

    var showSkills by remember { mutableStateOf(false) }

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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
        ) {
            Text(
                "Pide tareas y el modelo usará las habilidades concedidas.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = { showSkills = !showSkills }) {
                Text(if (showSkills) "Ocultar skills ▲" else "${agentTools().size} skills ▼", color = Signal)
            }
        }
        Spacer(Modifier.height(6.dp))

        if (showSkills) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F1523)),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(
                        "HABILIDADES ACTIVAS (Toca una para probar):",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                    Spacer(Modifier.height(8.dp))
                    LazyColumn(
                        modifier = Modifier.height(180.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(agentTools()) { tool ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(8.dp))
                                    .clickable {
                                        task = when (tool.name) {
                                            "alarma" -> "Pon una alarma a las 07:30 para despertar"
                                            "hora" -> "¿Qué hora y fecha es hoy?"
                                            "linterna" -> "Enciende la linterna"
                                            "info_dispositivo" -> "¿Cuánta batería y almacenamiento libre me queda?"
                                            "estado_red" -> "¿Estoy conectado a internet o en modo offline?"
                                            "calculadora_nativa" -> "Calcula sqrt(144) + 15 * 4"
                                            "ejecutar_script" -> "Ejecuta un script: sqrt(256) + 2^8"
                                            "estadisticas_y_algebra" -> "Calcula estadísticas de la muestra: 12, 19, 24, 15, 29, 34"
                                            "analisis_lenguaje" -> "Analiza la legibilidad de: El conocimiento y la privacidad son offline con Jinx."
                                            "cronologia_historia" -> "¿Qué ocurrió en el año 1789 en la historia universal?"
                                            "ciencias_fisica_quimica" -> "Consulta el elemento Hierro (Fe) y su masa atómica"
                                            "geografia_paises" -> "¿Cuál es la capital y población de Japón?"
                                            "logica_y_filosofia" -> "Explica la corriente del Estoicismo y sus máximas"
                                            "finanzas_prestamo_ahorro" -> "Calcula la cuota de una hipoteca de 150000 al 3.5% a 25 años"
                                            "calendario_evento" -> "Crea un recordatorio en el calendario para mañana a las 10:00"
                                            "listar_archivos" -> "Lista los archivos guardados en el almacenamiento"
                                            "leer_archivo" -> "Lee el archivo nota.txt"
                                            "guardar_archivo" -> "Guarda un archivo reporte.txt con un resumen"
                                            "abrir_camara" -> "Abre la cámara para tomar una foto"
                                            "abrir_ajustes" -> "Abre los ajustes de batería"
                                            "control_volumen" -> "Sube el volumen del teléfono"
                                            "control_multimedia" -> "Pausa o reanuda la música que está sonando"
                                            "enviar_sms" -> "Prepara un SMS para el 123456789 diciendo: Ya voy en camino"
                                            "abrir_whatsapp" -> "Abre WhatsApp con un mensaje para avisar de la reunión"
                                            "abrir_mapa" -> "Abre el mapa con la ruta hacia el centro de la ciudad"
                                            "portapapeles_copiar", "copiar_portapapeles" -> "Copia el texto 'ClaveSegura2026' al portapapeles"
                                            "portapapeles_leer", "leer_portapapeles" -> "Dime qué tengo copiado en el portapapeles"
                                            "reproducir_tono" -> "Emite un tono sonoro de alerta para localizar el móvil"
                                            "buscar_en_archivos" -> "Busca la palabra 'informe' en los archivos guardados"
                                            "eliminar_archivo" -> "Elimina el archivo temporal.txt del teléfono"
                                            "resumen_sistema_pro" -> "Muestra las especificaciones detalladas de hardware de este móvil"
                                            "crear_contacto" -> "Agrega un nuevo contacto llamado Carlos con teléfono 600123456"
                                            "abrir_app" -> "Abre la aplicación calculadora"
                                            "vibrar_dispositivo" -> "Activa una vibración doble de alerta en el teléfono"
                                            "compartir_contenido" -> "Comparte el texto 'Notas seguras de Jinx AI' con mis aplicaciones"
                                            "temporizador" -> "Inicia un temporizador de 120 segundos para la pizza"
                                            "abrir_enlace_web" -> "Abre https://wikipedia.org en el navegador"
                                            "enviar_email" -> "Prepara un correo para soporte@ejemplo.com con asunto Reunión y cuerpo Hola equipo"
                                            "abrir_ajuste" -> "Abre los ajustes de wifi en el sistema"
                                            "generar_pdf" -> "Genera un documento PDF con un informe sobre energía solar y guárdalo"
                                            "generar_csv" -> "Genera una hoja de cálculo CSV con ventas trimestrales y productos"
                                            "compartir_texto" -> "Comparte este reporte por WhatsApp"
                                            "hablar" -> "Lee en voz alta: Hola, soy Jinx, tu IA offline"
                                            "vibrar" -> "Vibra el teléfono por 500 ms"
                                            "ubicacion" -> "¿Cuáles son mis coordenadas actuales?"
                                            else -> "Ejecuta la habilidad ${tool.name}"
                                        }
                                        showSkills = false
                                    }
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(tool.name, color = Signal, style = MaterialTheme.typography.labelMedium)
                                    Text(tool.description, color = Color.Gray, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                                }
                                Text("Probar ›", color = Color.White.copy(alpha = 0.5f), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        }

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
