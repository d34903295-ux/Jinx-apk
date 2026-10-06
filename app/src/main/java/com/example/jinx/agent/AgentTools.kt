package com.example.jinx.agent

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.location.LocationManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.AlarmClock
import android.speech.tts.TextToSpeech
import androidx.core.content.ContextCompat
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Herramienta ejecutable en el teléfono. */
data class AgentTool(
    val name: String,
    val description: String,
    /** Permiso peligroso que exige, o null si no necesita. */
    val permission: String?,
    val execute: (ctx: Context, args: Map<String, String>) -> String,
)

fun hasPermission(ctx: Context, perm: String): Boolean =
    ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED

private var tts: TextToSpeech? = null

/** Catálogo de habilidades del agente. Solo actúa si el usuario concedió el permiso. */
fun agentTools(): List<AgentTool> = listOf(
    AgentTool(
        name = "hora",
        description = "Devuelve fecha y hora actual. Sin argumentos.",
        permission = null,
        execute = { _, _ ->
            LocalDateTime.now().format(DateTimeFormatter.ofPattern("EEEE d 'de' MMMM, HH:mm", Locale("es")))
        },
    ),
    AgentTool(
        name = "info_dispositivo",
        description = "Batería, RAM y almacenamiento del teléfono. Sin argumentos.",
        permission = null,
        execute = { ctx, _ ->
            val bm = ctx.getSystemService(BatteryManager::class.java)
            val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
            val freeGB = ctx.filesDir.usableSpace / 1073741824.0
            "Batería: $pct%. Almacenamiento interno libre: %.1f GB.".format(freeGB)
        },
    ),
    AgentTool(
        name = "ubicacion",
        description = "Ubicación aproximada (latitud, longitud). Sin argumentos.",
        permission = Manifest.permission.ACCESS_FINE_LOCATION,
        execute = { ctx, _ ->
            val lm = ctx.getSystemService(LocationManager::class.java) ?: return@AgentTool "Sin servicio de ubicación"
            val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            for (p in providers) {
                try {
                    val loc = lm.getLastKnownLocation(p)
                    if (loc != null) return@AgentTool "Lat %.5f, lon %.5f (aprox, %s)".format(loc.latitude, loc.longitude, p)
                } catch (_: SecurityException) {
                    return@AgentTool "ERROR: permiso de ubicación no concedido"
                }
            }
            "No hay ubicación reciente disponible. Activa el GPS."
        },
    ),
    AgentTool(
        name = "linterna",
        description = "Enciende o apaga el flash. args: {\"estado\": \"on\"|\"off\"}.",
        permission = Manifest.permission.CAMERA,
        execute = { ctx, args ->
            try {
                val cm = ctx.getSystemService(CameraManager::class.java) ?: return@AgentTool "Sin cámara"
                val id = cm.cameraIdList.firstOrNull() ?: return@AgentTool "Sin cámara"
                val on = args["estado"] != "off"
                cm.setTorchMode(id, on)
                if (on) "Linterna encendida." else "Linterna apagada."
            } catch (_: SecurityException) {
                "ERROR: permiso de cámara no concedido"
            } catch (e: Exception) {
                "ERROR: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "vibrar",
        description = "Vibra el teléfono. args: {\"ms\": \"500\"}.",
        permission = null,
        execute = { ctx, args ->
            val ms = args["ms"]?.toLongOrNull()?.coerceIn(50, 3000) ?: 400L
            val vib: Vibrator? = if (Build.VERSION.SDK_INT >= 31) {
                ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            vib?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
            "Vibración de $ms ms ejecutada."
        },
    ),
    AgentTool(
        name = "hablar",
        description = "Lee un texto en voz alta. args: {\"texto\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val text = args["texto"].orEmpty()
            if (text.isBlank()) return@AgentTool "ERROR: falta el texto"
            if (tts == null) {
                tts = TextToSpeech(ctx.applicationContext) { }
                Thread.sleep(800)
            }
            tts?.language = Locale("es")
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "nodo")
            "Leyendo en voz alta."
        },
    ),
    AgentTool(
        name = "temporizador",
        description = "Programa un temporizador visible. args: {\"segundos\": \"60\", \"mensaje\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val s = args["segundos"]?.toIntOrNull()?.coerceIn(1, 86400) ?: 60
            val i = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, s)
                putExtra(AlarmClock.EXTRA_MESSAGE, args["mensaje"] ?: "NODO")
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            return@AgentTool try {
                ctx.startActivity(i)
                "Temporizador de $s segundos programado."
            } catch (e: Exception) {
                "ERROR: no hay app de reloj (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "abrir_url",
        description = "Abre una URL o app con el sistema. args: {\"url\": \"https://...\"}.",
        permission = null,
        execute = { ctx, args ->
            val url = args["url"].orEmpty()
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                return@AgentTool "ERROR: solo URLs http/https"
            }
            return@AgentTool try {
                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                "Abriendo $url"
            } catch (e: Exception) {
                "ERROR: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "llamar",
        description = "Abre el marcador con un número (NO llama solo). args: {\"numero\": \"+34...\"}.",
        permission = null,
        execute = { ctx, args ->
            val num = args["numero"].orEmpty().filter { it.isDigit() || it == '+' }
            if (num.length < 3) return@AgentTool "ERROR: número inválido"
            return@AgentTool try {
                ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$num")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                "Marcador abierto con $num. El usuario debe pulsar llamar."
            } catch (e: Exception) {
                "ERROR: ${e.message}"
            }
        },
    ),
)

/** Permisos peligrosos que el agente puede pedir, con explicación. */
val AGENT_PERMISSIONS: List<Pair<String, String>> = listOf(
    Manifest.permission.ACCESS_FINE_LOCATION to "Ubicación: para decirte dónde estás.",
    Manifest.permission.CAMERA to "Cámara: solo para encender la linterna.",
)

/** Herramientas bloqueadas por falta de permiso (para mostrar estado). */
fun blockedTools(ctx: Context): List<AgentTool> =
    agentTools().filter { it.permission != null && !hasPermission(ctx, it.permission) }
