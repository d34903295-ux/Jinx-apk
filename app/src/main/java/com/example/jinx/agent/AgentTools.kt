package com.example.jinx.agent

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.content.ClipData
import android.content.ClipboardManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.BatteryManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.view.KeyEvent
import androidx.core.content.ContextCompat
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
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
        name = "create_code",
        description = "Crea o actualiza un archivo de código y lo abre en Code Studio Pro. Argumentos: title (título corto), language (html, javascript o python), code (código completo).",
        permission = null,
        execute = { _, args ->
            val title = args["title"] ?: args["nombre"] ?: "Código generado"
            val rawCode = args["code"] ?: args["script"] ?: args["codigo"] ?: ""
            val lang = args["language"] ?: args["lang"] ?: args["lenguaje"] ?: "html"
            com.example.jinx.llama.NodoBridge.openCodeTab(rawCode, lang, title)
            "Código '$title' ($lang) creado y abierto exitosamente en Code Studio Pro."
        },
    ),
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
            val isCharging = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val status = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS)
                status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
            } else false
            val chargingStr = if (isCharging) " (cargando)" else " (en batería)"
            val freeGB = ctx.filesDir.usableSpace / 1073741824.0
            val totalGB = ctx.filesDir.totalSpace / 1073741824.0
            val am = ctx.getSystemService(android.app.ActivityManager::class.java)
            val memInfo = android.app.ActivityManager.MemoryInfo()
            am?.getMemoryInfo(memInfo)
            val freeRamMB = memInfo.availMem / (1024 * 1024)
            val totalRamMB = memInfo.totalMem / (1024 * 1024)
            "Estado del teléfono: Batería: $pct%$chargingStr. Almacenamiento: %.1f GB libres de %.1f GB. RAM: %d MB libres de %d MB.".format(freeGB, totalGB, freeRamMB, totalRamMB)
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
                val rawVal = (args["estado"] ?: args["state"] ?: args["power"] ?: args["accion"] ?: args["action"] ?: "on").lowercase().trim()
                val on = when (rawVal) {
                    "off", "apagar", "desactivar", "false", "0", "no", "cerrar" -> false
                    else -> true
                }
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
            val rawMs = args["ms"] ?: args["duration"] ?: args["duracion"] ?: args["tiempo"] ?: args["millis"]
            val ms = rawMs?.filter { it.isDigit() }?.toLongOrNull()?.coerceIn(50, 4000) ?: 400L
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
            val rawSecs = args["segundos"] ?: args["seconds"] ?: args["tiempo"] ?: args["duration"]
            val rawMins = args["minutos"] ?: args["minutes"]
            val s = if (!rawMins.isNullOrBlank()) {
                val m = rawMins.filter { it.isDigit() || it == '.' }.toDoubleOrNull() ?: 1.0
                (m * 60).toInt().coerceIn(1, 86400)
            } else if (!rawSecs.isNullOrBlank()) {
                val num = rawSecs.filter { it.isDigit() }.toIntOrNull() ?: 60
                num.coerceIn(1, 86400)
            } else {
                60
            }
            val msg = args["mensaje"] ?: args["message"] ?: args["etiqueta"] ?: "Jinx"
            val i = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, s)
                putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            return@AgentTool try {
                ctx.startActivity(i)
                "Temporizador de $s segundos programado para '$msg'."
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
    AgentTool(
        name = "abrir_camara",
        description = "Abre la cámara del dispositivo para capturar una foto o documento para análisis multimodal. Sin argumentos.",
        permission = Manifest.permission.CAMERA,
        execute = { ctx, _ ->
            return@AgentTool try {
                val intent = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Cámara abierta para captura multimodal."
            } catch (e: Exception) {
                "ERROR: no se pudo abrir la cámara (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "guardar_archivo",
        description = "Guarda un archivo de texto en los documentos locales del teléfono. args: {\"nombre\": \"nota.txt\", \"contenido\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val nombre = args["nombre"]?.replace("[^a-zA-Z0-9._-]".toRegex(), "_") ?: "documento.txt"
            val contenido = args["contenido"].orEmpty()
            return@AgentTool try {
                val file = java.io.File(ctx.filesDir, nombre)
                file.writeText(contenido)
                "Archivo '$nombre' guardado localmente (${file.length()} bytes)."
            } catch (e: Exception) {
                "ERROR: al guardar archivo (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "alarma",
        description = "Configura una alarma en el reloj del teléfono. args: {\"hora\": \"07\", \"minutos\": \"30\", \"mensaje\": \"Despertador\"}.",
        permission = null,
        execute = { ctx, args ->
            var h = 7
            var m = 0
            val rawHora = args["hora"] ?: args["time"] ?: args["horario"]
            if (!rawHora.isNullOrBlank() && rawHora.contains(":")) {
                val parts = rawHora.split(":")
                h = parts.getOrNull(0)?.filter { it.isDigit() }?.toIntOrNull()?.coerceIn(0, 23) ?: 7
                m = parts.getOrNull(1)?.filter { it.isDigit() }?.toIntOrNull()?.coerceIn(0, 59) ?: 0
            } else {
                h = rawHora?.filter { it.isDigit() }?.toIntOrNull()?.coerceIn(0, 23) ?: 7
                val rawMin = args["minutos"] ?: args["minutes"] ?: args["minuto"]
                m = rawMin?.filter { it.isDigit() }?.toIntOrNull()?.coerceIn(0, 59) ?: 0
            }
            val msg = args["mensaje"] ?: args["message"] ?: args["etiqueta"] ?: "Alarma Jinx"
            val i = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, h)
                putExtra(AlarmClock.EXTRA_MINUTES, m)
                putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                ctx.startActivity(i)
                "Alarma configurada para las %02d:%02d ('%s').".format(h, m, msg)
            } catch (e: Exception) {
                "ERROR: no se pudo programar alarma (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "calendario_evento",
        description = "Crea un evento o recordatorio en el calendario del teléfono. args: {\"titulo\": \"Reunión\", \"descripcion\": \"Nota\"}.",
        permission = null,
        execute = { ctx, args ->
            val title = args["titulo"] ?: "Recordatorio Jinx"
            val desc = args["descripcion"] ?: ""
            val i = Intent(Intent.ACTION_INSERT).apply {
                data = CalendarContract.Events.CONTENT_URI
                putExtra(CalendarContract.Events.TITLE, title)
                putExtra(CalendarContract.Events.DESCRIPTION, desc)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                ctx.startActivity(i)
                "Evento '$title' preparado en el calendario."
            } catch (e: Exception) {
                "ERROR: al abrir calendario (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "leer_archivo",
        description = "Lee un archivo guardado por el usuario o agente. args: {\"nombre\": \"nota.txt\"}.",
        permission = null,
        execute = { ctx, args ->
            val nombre = args["nombre"]?.replace("[^a-zA-Z0-9._-]".toRegex(), "_") ?: "documento.txt"
            val file = java.io.File(ctx.filesDir, nombre)
            if (!file.exists()) return@AgentTool "El archivo '$nombre' no existe."
            try {
                val content = file.readText().take(4000)
                "Contenido de '$nombre' (${file.length()} bytes):\n$content"
            } catch (e: Exception) {
                "ERROR al leer archivo (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "listar_archivos",
        description = "Lista todos los archivos guardados localmente en el teléfono. Sin argumentos.",
        permission = null,
        execute = { ctx, _ ->
            val files = ctx.filesDir.listFiles()?.filter { it.isFile && !it.name.endsWith(".bin") } ?: emptyList()
            if (files.isEmpty()) return@AgentTool "No hay archivos guardados en el almacenamiento local."
            files.joinToString("\n") { "• ${it.name} (${it.length()} bytes)" }
        },
    ),
    AgentTool(
        name = "estado_red",
        description = "Comprueba el estado de red y modo avión (WiFi, datos móviles, offline). Sin argumentos.",
        permission = null,
        execute = { ctx, _ ->
            val cm = ctx.getSystemService(ConnectivityManager::class.java)
            val active = cm?.activeNetwork
            val caps = active?.let { cm.getNetworkCapabilities(it) }
            val hasWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            val hasCell = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true
            val isOnline = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
            if (isOnline) {
                "Conectado a Internet (WiFi: $hasWifi, Celular: $hasCell). Motor IA operando 100% offline."
            } else {
                "MODO OFFLINE ACTIVO (Sin conexión a Internet). Todos los modelos y herramientas operan localmente."
            }
        },
    ),
    AgentTool(
        name = "calculadora_nativa",
        description = "Resuelve cálculos matemáticos (+, -, *, /, ^, %, sqrt). args: {\"expresion\": \"15 * 12 + 50\"}.",
        permission = null,
        execute = { _, args ->
            val exp = args["expresion"].orEmpty().trim()
            if (exp.isBlank()) return@AgentTool "Falta la expresión matemática."
            try {
                val clean = exp.replace("×", "*").replace("÷", "/")
                val result = evaluateMathExpression(clean)
                "Resultado de $exp = $result"
            } catch (e: Exception) {
                "ERROR al calcular ($exp): ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "abrir_ajustes",
        description = "Abre un menú de ajustes del teléfono. args: {\"seccion\": \"bateria\"|\"wifi\"|\"pantalla\"|\"ubicacion\"|\"general\"}.",
        permission = null,
        execute = { ctx, args ->
            val action = when (args["seccion"]?.lowercase()) {
                "bateria" -> Settings.ACTION_BATTERY_SAVER_SETTINGS
                "wifi" -> Settings.ACTION_WIFI_SETTINGS
                "pantalla" -> Settings.ACTION_DISPLAY_SETTINGS
                "ubicacion" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
                else -> Settings.ACTION_SETTINGS
            }
            try {
                ctx.startActivity(Intent(action).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
                "Ajustes de ${args["seccion"] ?: "sistema"} abiertos."
            } catch (e: Exception) {
                "ERROR al abrir ajustes (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "compartir_texto",
        description = "Comparte un texto o reporte con otra app (WhatsApp, correo, notas). args: {\"texto\": \"...\", \"titulo\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val text = args["texto"].orEmpty()
            val title = args["titulo"] ?: "Compartir desde Jinx"
            if (text.isBlank()) return@AgentTool "ERROR: falta el texto a compartir"
            try {
                val sendIntent = Intent().apply {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_TEXT, text)
                    type = "text/plain"
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                val chooser = Intent.createChooser(sendIntent, title).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(chooser)
                "Menú de compartir abierto con el texto."
            } catch (e: Exception) {
                "ERROR al compartir (${e.message})"
            }
        },
    ),
    AgentTool(
        name = "ejecutar_script",
        description = "Ejecuta un script o expresión matemática/algorítmica en el evaluador local de Jinx. args: {\"codigo\": \"...\"}.",
        permission = null,
        execute = { _, args ->
            val code = args["codigo"].orEmpty().trim()
            if (code.isBlank()) return@AgentTool "ERROR: falta el código o expresión a evaluar."
            try {
                val res = evaluateMathExpression(code)
                "EJECUCIÓN SCRIPT LOCAL:\nResultado: $res"
            } catch (e: Exception) {
                "ERROR de ejecución: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "estadisticas_y_algebra",
        description = "Resuelve problemas matemáticos: 'stats' (media, mediana, desv. típica), 'cuadratica' (a, b, c), 'primos' (descomposición factorial), 'mcd' (a y b). args: {\"modo\": \"stats|cuadratica|primos|mcd\", \"datos\": \"...\"}.",
        permission = null,
        execute = { _, args ->
            val modo = args["modo"]?.lowercase() ?: "stats"
            val datos = args["datos"].orEmpty()
            when (modo) {
                "stats" -> {
                    val nums = datos.split(Regex("[,\\s]+")).mapNotNull { it.trim().toDoubleOrNull() }.sorted()
                    if (nums.isEmpty()) return@AgentTool "Proporciona números separados por comas o espacios."
                    val n = nums.size
                    val sum = nums.sum()
                    val mean = sum / n
                    val median = if (n % 2 == 0) (nums[n / 2 - 1] + nums[n / 2]) / 2.0 else nums[n / 2]
                    val variance = nums.map { Math.pow(it - mean, 2.0) }.sum() / (if (n > 1) n - 1 else 1)
                    val std = Math.sqrt(variance)
                    val min = nums.first()
                    val max = nums.last()
                    "ESTADÍSTICAS (N = $n):\n• Suma: $sum\n• Media: $mean\n• Mediana: $median\n• Rango: [$min .. $max] (amplitud: ${max - min})\n• Desv. Estándar (σ): $std"
                }
                "cuadratica" -> {
                    val a = Regex("a\\s*=\\s*([-\\d.]+)").find(datos)?.groupValues?.get(1)?.toDoubleOrNull() ?: 1.0
                    val b = Regex("b\\s*=\\s*([-\\d.]+)").find(datos)?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.0
                    val c = Regex("c\\s*=\\s*([-\\d.]+)").find(datos)?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.0
                    if (a == 0.0) return@AgentTool "No es cuadrática (a no puede ser 0)."
                    val disc = b * b - 4 * a * c
                    if (disc >= 0) {
                        val x1 = (-b + Math.sqrt(disc)) / (2 * a)
                        val x2 = (-b - Math.sqrt(disc)) / (2 * a)
                        "ECUACIÓN CUADRÁTICA ($a x² + $b x + $c = 0):\n• Discriminante (Δ): $disc\n• Raíces reales: x₁ = $x1, x₂ = $x2"
                    } else {
                        val real = -b / (2 * a)
                        val imag = Math.sqrt(-disc) / (2 * a)
                        "ECUACIÓN CUADRÁTICA ($a x² + $b x + $c = 0):\n• Raíces complejas: x = $real ± ${imag}i"
                    }
                }
                "primos" -> {
                    var n = datos.filter { it.isDigit() }.toLongOrNull() ?: return@AgentTool "Introduce un número válido."
                    if (n < 2) return@AgentTool "Introduce un número mayor o igual a 2."
                    val factors = mutableMapOf<Long, Int>()
                    var d = 2L
                    while (d * d <= n) {
                        while (n % d == 0L) {
                            factors[d] = (factors[d] ?: 0) + 1
                            n /= d
                        }
                        d++
                    }
                    if (n > 1L) factors[n] = (factors[n] ?: 0) + 1
                    val repr = factors.entries.joinToString(" × ") { (f, exp) -> if (exp > 1) "$f^$exp" else "$f" }
                    "DESCOMPOSICIÓN EN FACTORES PRIMOS:\n$repr"
                }
                "mcd" -> {
                    val list = Regex("\\d+").findAll(datos).map { it.value.toLong() }.toList()
                    if (list.size < 2) return@AgentTool "Proporciona al menos 2 números."
                    fun gcd(x: Long, y: Long): Long = if (y == 0L) x else gcd(y, x % y)
                    val d = gcd(list[0], list[1])
                    val m = (list[0] * list[1]) / d
                    "MCD Y MCM (${list[0]}, ${list[1]}):\n• MCD: $d\n• mcm: $m"
                }
                else -> "Modo no reconocido: usa 'stats', 'cuadratica', 'primos' o 'mcd'."
            }
        },
    ),
    AgentTool(
        name = "analisis_lenguaje",
        description = "Herramientas de lenguaje: 'legibilidad' (índice Flesch-Szigriszt), 'cifrado' (César con desplazamiento N), 'palindromo', 'gramatica'. args: {\"accion\": \"legibilidad|cifrado|palindromo|gramatica\", \"texto\": \"...\", \"param\": \"...\"}.",
        permission = null,
        execute = { _, args ->
            val accion = args["accion"]?.lowercase() ?: "legibilidad"
            val texto = args["texto"].orEmpty().trim()
            val param = args["param"].orEmpty()
            when (accion) {
                "legibilidad" -> {
                    val words = Regex("[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+").findAll(texto).map { it.value }.toList()
                    val totalWords = words.size
                    if (totalWords == 0) return@AgentTool "Texto vacío o sin palabras legibles."
                    val sentences = texto.split(Regex("[.!?]+")).filter { it.isNotBlank() }
                    val totalSentences = maxOf(1, sentences.size)
                    val totalSyllables = words.sumOf { w ->
                        val vg = Regex("[aáeéoóíúuiy]+", RegexOption.IGNORE_CASE).findAll(w).count()
                        maxOf(1, vg)
                    }
                    val sylPerWord = totalSyllables.toDouble() / totalWords
                    val wordsPerSent = totalWords.toDouble() / totalSentences
                    val szigriszt = 206.835 - (62.3 * sylPerWord) - wordsPerSent
                    val nivel = when {
                        szigriszt >= 75 -> "Fácil / Divulgación popular"
                        szigriszt >= 60 -> "Estándar / Medios de prensa"
                        szigriszt >= 45 -> "Moderado / Nivel secundario"
                        else -> "Complejo / Texto técnico universitario"
                    }
                    "LEGIBILIDAD DEL TEXTO:\n• Palabras: $totalWords | Frases: $totalSentences\n• Palabras/Frase: ${"%.1f".format(wordsPerSent)} | Sílabas/Palabra: ${"%.2f".format(sylPerWord)}\n• Flesch-Szigriszt: ${"%.1f".format(szigriszt)} / 100 ($nivel)"
                }
                "cifrado" -> {
                    val shift = param.filter { it.isDigit() || it == '-' }.toIntOrNull() ?: 13
                    val res = texto.map { c ->
                        if (c in 'a'..'z') {
                            val base = 'a'.code
                            val code = (((c.code - base + shift) % 26 + 26) % 26) + base
                            code.toChar()
                        } else if (c in 'A'..'Z') {
                            val base = 'A'.code
                            val code = (((c.code - base + shift) % 26 + 26) % 26) + base
                            code.toChar()
                        } else c
                    }.joinToString("")
                    "CIFRADO CÉSAR (Desplazamiento $shift):\n$res"
                }
                "palindromo" -> {
                    val clean = texto.lowercase().filter { it.isLetterOrDigit() }
                    val isPal = clean.length > 1 && clean == clean.reversed()
                    if (isPal) "El texto ES un palíndromo (se lee igual al revés)." else "El texto NO es un palíndromo."
                }
                "gramatica" -> {
                    "GUÍA GRAMATICAL ESPAÑOL:\n• Agudas: acento en última sílaba (tilde con vocal, n, s).\n• Llanas: acento en penúltima (tilde si NO acaba en vocal, n, s).\n• Esdrújulas: siempre llevan tilde.\n• Por qué (pregunta) / Porque (causa) / El porqué (sustantivo)."
                }
                else -> "Acción no válida: usa legibilidad, cifrado, palindromo o gramatica."
            }
        },
    ),
    AgentTool(
        name = "cronologia_historia",
        description = "Explora hitos de historia universal offline por año, personaje o era. args: {\"consulta\": \"1789|roma|luna|segunda guerra...\"}.",
        permission = null,
        execute = { _, args ->
            val q = args["consulta"].orEmpty().lowercase().trim()
            val hits = listOf(
                "3500 a.C." to "Invención de la escritura cuneiforme en Mesopotamia (fin de la prehistoria).",
                "2560 a.C." to "Construcción de la Gran Pirámide de Guiza en Egipto.",
                "508 a.C." to "Nacimiento de la democracia en Atenas con las reformas de Clístenes.",
                "44 a.C." to "Magnicidio de Julio César en el Senado de Roma.",
                "27 a.C." to "Augusto instaura el Imperio Romano.",
                "476 d.C." to "Caída del Imperio Romano de Occidente; comienzo de la Edad Media.",
                "622 d.C." to "La Hégira de Mahoma y fundación del Islam.",
                "800 d.C." to "Coronación de Carlomagno como emperador en Roma.",
                "1095 d.C." to "Llamamiento del Papa Urbano II e inicio de las Cruzadas.",
                "1347 d.C." to "La Peste Negra asola Europa.",
                "1453 d.C." to "Caída de Constantinopla e imprenta de tipos móviles de Gutenberg.",
                "1492 d.C." to "Llegada de Cristóbal Colón a América y fin de la Reconquista en Granada.",
                "1517 d.C." to "Reforma Protestante de Martín Lutero en Wittenberg.",
                "1776 d.C." to "Declaración de Independencia de los Estados Unidos.",
                "1789 d.C." to "Revolución Francesa y toma de la Bastilla.",
                "1810-1825" to "Guerras de Independencia en Hispanoamérica (Bolívar, San Martín).",
                "1914-1918" to "Primera Guerra Mundial.",
                "1939-1945" to "Segunda Guerra Mundial y creación de la ONU.",
                "1969 d.C." to "Apolo 11: Llegada del ser humano a la Luna.",
                "1989 d.C." to "Caída del Muro de Berlín y fin de la Guerra Fría.",
                "1991 d.C." to "Creación de la World Wide Web e inicio de la era de Internet."
            ).filter { (year, desc) ->
                q.isBlank() || year.lowercase().contains(q) || desc.lowercase().contains(q)
            }
            if (hits.isEmpty()) return@AgentTool "No se encontraron hitos para '$q'."
            hits.joinToString("\n\n") { (year, desc) -> "📅 [$year]\n• $desc" }
        },
    ),
    AgentTool(
        name = "ciencias_fisica_quimica",
        description = "Consulta la tabla periódica y fórmulas físicas: 'elemento' (ej. Fe, Oro), 'fuerza' (m, a), 'cinetica' (m, v), 'relatividad' (m). args: {\"tipo\": \"elemento|fuerza|cinetica|relatividad\", \"query\": \"...\"}.",
        permission = null,
        execute = { _, args ->
            val tipo = args["tipo"]?.lowercase() ?: "elemento"
            val q = args["query"].orEmpty().lowercase().trim()
            when (tipo) {
                "elemento" -> {
                    val elements = mapOf(
                        "h" to "Hidrógeno (H) - Z: 1, Masa: 1.008 u, No metal, 1s¹",
                        "he" to "Helio (He) - Z: 2, Masa: 4.0026 u, Gas noble, 1s²",
                        "c" to "Carbono (C) - Z: 6, Masa: 12.011 u, No metal, [He] 2s² 2p²",
                        "o" to "Oxígeno (O) - Z: 8, Masa: 15.999 u, No metal, [He] 2s² 2p⁴",
                        "fe" to "Hierro (Fe) - Z: 26, Masa: 55.845 u, Metal de transición, [Ar] 3d⁶ 4s²",
                        "au" to "Oro (Au) - Z: 79, Masa: 196.97 u, Metal noble de transición, [Xe] 4f¹⁴ 5d¹⁰ 6s¹",
                        "u" to "Uranio (U) - Z: 92, Masa: 238.03 u, Actínido radiactivo, [Rn] 5f³ 6d¹ 7s²"
                    )
                    val found = elements.entries.find { (sym, desc) -> sym == q || desc.lowercase().contains(q) }
                    found?.value ?: "Elemento no encontrado. Muestra disponible: H, He, C, O, Fe, Au, U."
                }
                "fuerza" -> {
                    val m = Regex("m\\s*=\\s*([-\\d.]+)").find(q)?.groupValues?.get(1)?.toDoubleOrNull() ?: 5.0
                    val a = Regex("a\\s*=\\s*([-\\d.]+)").find(q)?.groupValues?.get(1)?.toDoubleOrNull() ?: 9.8
                    "FUERZA (F = m·a): ${(m * a)} N (Newtons)"
                }
                "cinetica" -> {
                    val m = Regex("m\\s*=\\s*([-\\d.]+)").find(q)?.groupValues?.get(1)?.toDoubleOrNull() ?: 2.0
                    val v = Regex("v\\s*=\\s*([-\\d.]+)").find(q)?.groupValues?.get(1)?.toDoubleOrNull() ?: 10.0
                    val ec = 0.5 * m * v * v
                    "ENERGÍA CINÉTICA (Ec = ½·m·v²): $ec Julios (J)"
                }
                "relatividad" -> {
                    val m = Regex("m\\s*=\\s*([-\\d.]+)").find(q)?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.001
                    val c = 299792458.0
                    val e = m * c * c
                    "ENERGÍA EN REPOSO (E = m·c²): $e Julios (J)"
                }
                else -> "Tipo no válido: usa elemento, fuerza, cinetica o relatividad."
            }
        },
    ),
    AgentTool(
        name = "geografia_paises",
        description = "Atlas de países del mundo offline: capital, población, continente, moneda e idiomas. args: {\"pais\": \"España|México|Argentina...\"}.",
        permission = null,
        execute = { _, args ->
            val p = args["pais"].orEmpty().lowercase().trim()
            val atlas = mapOf(
                "españa" to "🇪🇸 España: Capital Madrid, Europa, 47.5M hab, Euro (EUR), idioma Español",
                "mexico" to "🇲🇽 México: Capital Ciudad de México, América, 128M hab, Peso (MXN), idioma Español",
                "méxico" to "🇲🇽 México: Capital Ciudad de México, América, 128M hab, Peso (MXN), idioma Español",
                "argentina" to "🇦🇷 Argentina: Capital Buenos Aires, América, 46M hab, Peso (ARS), idioma Español",
                "colombia" to "🇨🇴 Colombia: Capital Bogotá, América, 51.5M hab, Peso (COP), idioma Español",
                "chile" to "🇨🇱 Chile: Capital Santiago, América, 19.5M hab, Peso (CLP), idioma Español",
                "estados unidos" to "🇺🇸 Estados Unidos: Capital Washington D.C., América, 335M hab, Dólar (USD), idioma Inglés",
                "japon" to "🇯🇵 Japón: Capital Tokio, Asia, 125M hab, Yen (JPY), idioma Japonés",
                "japón" to "🇯🇵 Japón: Capital Tokio, Asia, 125M hab, Yen (JPY), idioma Japonés",
                "alemania" to "🇩🇪 Alemania: Capital Berlín, Europa, 84M hab, Euro (EUR), idioma Alemán",
                "francia" to "🇫🇷 Francia: Capital París, Europa, 68M hab, Euro (EUR), idioma Francés",
                "italia" to "🇮🇹 Italia: Capital Roma, Europa, 59M hab, Euro (EUR), idioma Italiano"
            )
            val res = atlas.entries.find { (name, _) -> name.contains(p) || p.contains(name) }
            res?.value ?: "País no encontrado en el atlas básico. Consulta por España, México, Argentina, Colombia, Chile, Estados Unidos, Japón, etc."
        },
    ),
    AgentTool(
        name = "logica_y_filosofia",
        description = "Lógica proposicional, corrientes filosóficas (Estoicismo, Existencialismo) y falacias lógicas. args: {\"tema\": \"tabla_verdad|falacias|filosofia\"}.",
        permission = null,
        execute = { _, args ->
            val t = args["tema"]?.lowercase() ?: "tabla_verdad"
            when {
                t.contains("tabla") -> "TABLA DE VERDAD (A, B):\n• V ∧ V = V | V ∧ F = F\n• V ∨ F = V | F ∨ F = F\n• ¬V = F | ¬F = V\n• V → F = F (todas las demás implicaciones son V)"
                t.contains("falacia") -> "FALACIAS CLÁSICAS:\n• Ad Hominem: Atacar al emisor y no al argumento.\n• Hombre de paja: Caricaturizar la postura contraria.\n• Falso dilema: Reducir las opciones a dos extremos.\n• Post hoc: Confundir correlación cronológica con causa."
                t.contains("filosof") -> "CORRIENTES FILOSÓFICAS:\n• Estoicismo (Séneca, Epicteto): Foco en lo que controlamos; serenidad racional.\n• Racionalismo (Descartes): La razón como principio del saber (Cogito ergo sum).\n• Existencialismo (Sartre, Camus): La existencia precede a la esencia; libertad responsable."
                else -> "Usa 'tabla_verdad', 'falacias' o 'filosofia'."
            }
        },
    ),
    AgentTool(
        name = "finanzas_prestamo_ahorro",
        description = "Calcula cuota mensual de préstamos/hipotecas y proyecciones de ahorro compuesto. args: {\"tipo\": \"prestamo|ahorro\", \"datos\": \"monto=100000, interes=3.5, anos=20\"}.",
        permission = null,
        execute = { _, args ->
            val tipo = args["tipo"]?.lowercase() ?: "prestamo"
            val d = args["datos"].orEmpty()
            if (tipo.contains("prestamo") || tipo.contains("hipoteca")) {
                val P = Regex("monto\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 100000.0
                val rate = (Regex("interes\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 3.5) / 100.0
                val years = Regex("anos\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 20.0
                val n = (years * 12).toInt()
                val r = rate / 12.0
                val pmt = (P * r * Math.pow(1 + r, n.toDouble())) / (Math.pow(1 + r, n.toDouble()) - 1)
                val total = pmt * n
                "HIPOTECA / PRÉSTAMO (Sistema Francés):\n• Capital: ${P.toLong()} €\n• Interés anual: ${(rate * 100)}% a $years años ($n cuotas)\n• Cuota mensual: ${"%.2f".format(pmt)} €/mes\n• Coste total intereses: ${"%.2f".format(total - P)} €"
            } else {
                val init = Regex("inicial\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 1000.0
                val pmt = Regex("mensual\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 100.0
                val rate = (Regex("interes\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 7.0) / 100.0
                val years = Regex("anos\\s*=\\s*([-\\d.]+)").find(d)?.groupValues?.get(1)?.toDoubleOrNull() ?: 10.0
                val months = (years * 12).toInt()
                val r = rate / 12.0
                val fv = init * Math.pow(1 + r, months.toDouble()) + pmt * ((Math.pow(1 + r, months.toDouble()) - 1) / r)
                "INTERÉS COMPUESTO CON APORTACIONES:\n• Inicial: ${init.toLong()} € + ${pmt.toLong()} €/mes a $years años al ${(rate * 100)}%\n• Capital acumulado final: ${"%.2f".format(fv)} €"
            }
        },
    ),
    AgentTool(
        name = "control_volumen",
        description = "Ajusta el volumen del sistema o multimedia: 'subir', 'bajar' o 'silenciar'. args: {\"accion\": \"subir|bajar|silenciar\"}.",
        permission = null,
        execute = { ctx, args ->
            val am = ctx.getSystemService(AudioManager::class.java)
            if (am == null) return@AgentTool "Servicio de audio no disponible."
            val accion = args["accion"]?.lowercase() ?: "subir"
            try {
                when (accion) {
                    "subir" -> {
                        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                        "Volumen subido."
                    }
                    "bajar" -> {
                        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                        "Volumen bajado."
                    }
                    "silenciar" -> {
                        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, AudioManager.FLAG_SHOW_UI)
                        "Dispositivo silenciado."
                    }
                    else -> "Acción no reconocida. Usa 'subir', 'bajar' o 'silenciar'."
                }
            } catch (e: Exception) {
                "Error al ajustar volumen: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "control_multimedia",
        description = "Controla la música del teléfono: 'play_pause', 'siguiente' o 'anterior'. args: {\"accion\": \"play_pause|siguiente|anterior\"}.",
        permission = null,
        execute = { ctx, args ->
            val am = ctx.getSystemService(AudioManager::class.java)
            if (am == null) return@AgentTool "Servicio de audio no disponible."
            val accion = args["accion"]?.lowercase() ?: "play_pause"
            val keyCode = when (accion) {
                "siguiente", "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
                "anterior", "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
                else -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
            }
            try {
                am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
                am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
                "Comando multimedia '$accion' enviado al reproductor."
            } catch (e: Exception) {
                "Error multimedia: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "enviar_sms",
        description = "Prepara un mensaje SMS en el teléfono. args: {\"telefono\": \"...\", \"mensaje\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val tel = args["telefono"].orEmpty().filter { it.isDigit() || it == '+' }
            val msg = args["mensaje"].orEmpty()
            if (tel.isBlank()) return@AgentTool "ERROR: falta el número de teléfono."
            try {
                val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$tel")).apply {
                    putExtra("sms_body", msg)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Aplicación de mensajes SMS abierta con el destinatario y texto listos."
            } catch (e: Exception) {
                "Error al abrir SMS: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "abrir_whatsapp",
        description = "Abre un chat directo en WhatsApp con un número y texto predeterminado. args: {\"telefono\": \"...\", \"mensaje\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val tel = args["telefono"].orEmpty().filter { it.isDigit() }
            val msg = args["mensaje"].orEmpty()
            try {
                val url = if (tel.isNotBlank()) {
                    "https://api.whatsapp.com/send?phone=$tel&text=${Uri.encode(msg)}"
                } else {
                    "https://api.whatsapp.com/send?text=${Uri.encode(msg)}"
                }
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "WhatsApp abierto con el mensaje preparado."
            } catch (e: Exception) {
                "Error al abrir WhatsApp: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "abrir_mapa",
        description = "Abre la aplicación de mapas y navegación GPS hacia un destino o lugar. args: {\"destino\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val destino = args["destino"].orEmpty().trim()
            if (destino.isBlank()) return@AgentTool "ERROR: falta el destino o dirección."
            try {
                val uri = Uri.parse("geo:0,0?q=${Uri.encode(destino)}")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Mapas y navegación GPS abiertos para '$destino'."
            } catch (e: Exception) {
                "Error al abrir mapas: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "copiar_portapapeles",
        description = "Copia cualquier texto, código o nota al portapapeles global del teléfono. args: {\"texto\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val texto = args["texto"].orEmpty()
            if (texto.isBlank()) return@AgentTool "ERROR: falta el texto a copiar."
            try {
                val cm = ctx.getSystemService(ClipboardManager::class.java)
                cm?.setPrimaryClip(ClipData.newPlainText("Jinx", texto))
                "Texto copiado al portapapeles exitosamente."
            } catch (e: Exception) {
                "Error al copiar al portapapeles: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "leer_portapapeles",
        description = "Lee el contenido actual del portapapeles del teléfono. Sin argumentos.",
        permission = null,
        execute = { ctx, _ ->
            try {
                val cm = ctx.getSystemService(ClipboardManager::class.java)
                val clip = cm?.primaryClip
                if (clip != null && clip.itemCount > 0) {
                    val text = clip.getItemAt(0)?.coerceToText(ctx)?.toString().orEmpty()
                    if (text.isNotBlank()) "Portapapeles actual:\n$text" else "El portapapeles está vacío."
                } else {
                    "El portapapeles está vacío."
                }
            } catch (e: Exception) {
                "Error al leer portapapeles: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "reproducir_tono",
        description = "Emite un tono sonoro acústico de alerta en el altavoz del teléfono. Sin argumentos.",
        permission = null,
        execute = { _, _ ->
            try {
                val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                tone.startTone(ToneGenerator.TONE_PROP_BEEP, 350)
                "Tono sonoro de alerta reproducido en el teléfono."
            } catch (e: Exception) {
                "Error al emitir tono: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "crear_contacto",
        description = "Prepara la adición de un nuevo contacto en la agenda del teléfono. args: {\"nombre\": \"...\", \"telefono\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val nombre = args["nombre"].orEmpty()
            val tel = args["telefono"].orEmpty()
            try {
                val intent = Intent(ContactsContract.Intents.Insert.ACTION).apply {
                    type = ContactsContract.RawContacts.CONTENT_TYPE
                    putExtra(ContactsContract.Intents.Insert.NAME, nombre)
                    putExtra(ContactsContract.Intents.Insert.PHONE, tel)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Pantalla de nuevo contacto preparada con nombre: $nombre, teléfono: $tel."
            } catch (e: Exception) {
                "Error al crear contacto: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "abrir_app",
        description = "Lanza una aplicación del sistema: 'calculadora', 'reloj', 'calendario', 'ajustes' o 'galeria'. args: {\"app\": \"calculadora|reloj|calendario|ajustes|galeria\"}.",
        permission = null,
        execute = { ctx, args ->
            val app = args["app"]?.lowercase() ?: "calculadora"
            try {
                val intent = when (app) {
                    "calculadora" -> Intent().apply {
                        action = Intent.ACTION_MAIN
                        addCategory(Intent.CATEGORY_APP_CALCULATOR)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    "calendario" -> Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_APP_CALENDAR)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    "galeria" -> Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_APP_GALLERY)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    "reloj" -> Intent(AlarmClock.ACTION_SHOW_ALARMS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    "ajustes" -> Intent(Settings.ACTION_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    else -> Intent(Settings.ACTION_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                ctx.startActivity(intent)
                "Aplicación '$app' abierta en el teléfono."
            } catch (e: Exception) {
                "No se pudo abrir '$app' directamente (${e.message})."
            }
        },
    ),
    AgentTool(
        name = "vibrar_dispositivo",
        description = "Emite una vibración táctil física en el teléfono. Argumento: patron (corto, largo, doble, sos).",
        permission = null,
        execute = { ctx, args ->
            val patron = args["patron"]?.lowercase() ?: "corto"
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vm?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                }

                if (vibrator == null || !vibrator.hasVibrator()) {
                    "El dispositivo no cuenta con motor de vibración disponible."
                } else {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        when (patron) {
                            "largo" -> vibrator.vibrate(VibrationEffect.createOneShot(600, VibrationEffect.DEFAULT_AMPLITUDE))
                            "doble" -> vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 150, 100, 150), -1))
                            "sos" -> vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 150, 100, 150, 100, 150, 200, 400, 100, 400, 100, 400, 200, 150, 100, 150, 100, 150), -1))
                            else -> vibrator.vibrate(VibrationEffect.createOneShot(120, VibrationEffect.DEFAULT_AMPLITUDE))
                        }
                    } else {
                        @Suppress("DEPRECATION")
                        when (patron) {
                            "largo" -> vibrator.vibrate(600)
                            "doble" -> vibrator.vibrate(longArrayOf(0, 150, 100, 150), -1)
                            "sos" -> vibrator.vibrate(longArrayOf(0, 150, 100, 150, 100, 150, 200, 400, 100, 400, 100, 400, 200, 150, 100, 150, 100, 150), -1)
                            else -> vibrator.vibrate(120)
                        }
                    }
                    "Vibración física activada con patrón '$patron'."
                }
            } catch (e: Exception) {
                "Error al vibrar: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "compartir_contenido",
        description = "Abre la hoja de compartir nativa de Android para enviar texto a cualquier app (WhatsApp, Telegram, Gmail, Notas, etc.). Argumentos: texto, titulo (opcional).",
        permission = null,
        execute = { ctx, args ->
            val texto = args["texto"] ?: return@AgentTool "Falta el argumento 'texto'."
            val titulo = args["titulo"] ?: "Compartir con Jinx"
            try {
                val sendIntent = Intent().apply {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_TEXT, texto)
                    type = "text/plain"
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                val shareIntent = Intent.createChooser(sendIntent, titulo).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(shareIntent)
                "Hoja de compartir nativa desplegada para '$titulo'."
            } catch (e: Exception) {
                "Error al compartir: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "temporizador",
        description = "Inicia una cuenta regresiva/temporizador en la app de reloj del teléfono. Argumentos: segundos (número), mensaje (opcional).",
        permission = null,
        execute = { ctx, args ->
            val segs = args["segundos"]?.toIntOrNull() ?: 60
            val msg = args["mensaje"] ?: "Temporizador Jinx"
            try {
                val timerIntent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                    putExtra(AlarmClock.EXTRA_LENGTH, segs)
                    putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                    putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(timerIntent)
                "Temporizador de $segs segundos programado para '$msg'."
            } catch (e: Exception) {
                "No se pudo programar el temporizador (${e.message})."
            }
        },
    ),
    AgentTool(
        name = "abrir_enlace_web",
        description = "Abre un enlace web o realiza una búsqueda en el navegador predeterminado. Argumento: url (ej. https://es.wikipedia.org o término de búsqueda).",
        permission = null,
        execute = { ctx, args ->
            val queryOrUrl = args["url"] ?: return@AgentTool "Falta el argumento 'url'."
            try {
                val uri = if (queryOrUrl.startsWith("http://") || queryOrUrl.startsWith("https://")) {
                    Uri.parse(queryOrUrl)
                } else {
                    Uri.parse("https://duckduckgo.com/?q=${Uri.encode(queryOrUrl)}")
                }
                val browserIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(browserIntent)
                "Navegador abierto con: $uri"
            } catch (e: Exception) {
                "Error al abrir enlace: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "enviar_email",
        description = "Prepara un correo electrónico en la app de correo del usuario. Argumentos: email (destinatario), asunto, cuerpo.",
        permission = null,
        execute = { ctx, args ->
            val email = args["email"] ?: ""
            val asunto = args["asunto"] ?: "Mensaje desde Jinx"
            val cuerpo = args["cuerpo"] ?: ""
            try {
                val emailUri = Uri.parse("mailto:$email?subject=${Uri.encode(asunto)}&body=${Uri.encode(cuerpo)}")
                val emailIntent = Intent(Intent.ACTION_SENDTO, emailUri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(emailIntent)
                "Borrador de correo preparado para: ${if (email.isNotEmpty()) email else "destinatario"}."
            } catch (e: Exception) {
                "Error al preparar correo: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "abrir_ajuste",
        description = "Abre una pantalla de ajustes específica del sistema Android. Argumento: seccion ('wifi', 'bluetooth', 'pantalla', 'sonido', 'bateria', 'aplicaciones', 'almacenamiento', 'privacidad').",
        permission = null,
        execute = { ctx, args ->
            val seccion = args["seccion"]?.lowercase() ?: "general"
            try {
                val intent = when (seccion) {
                    "wifi" -> Intent(Settings.ACTION_WIFI_SETTINGS)
                    "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                    "pantalla", "brillo" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
                    "sonido", "audio" -> Intent(Settings.ACTION_SOUND_SETTINGS)
                    "bateria" -> Intent(Intent.ACTION_POWER_USAGE_SUMMARY)
                    "aplicaciones", "apps" -> Intent(Settings.ACTION_APPLICATION_SETTINGS)
                    "privacidad" -> Intent(Settings.ACTION_PRIVACY_SETTINGS)
                    "almacenamiento" -> Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS)
                    else -> Intent(Settings.ACTION_SETTINGS)
                }.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Ajustes de '$seccion' abiertos en el teléfono."
            } catch (e: Exception) {
                "Error al abrir ajustes de $seccion: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "generar_pdf",
        description = "Genera un documento PDF profesional nativo (A4) 100% offline con título, metadatos y contenido formateado. Argumentos: titulo, contenido, subtitulo (opcional), archivo (opcional).",
        permission = null,
        execute = { ctx, args ->
            val titulo = args["titulo"] ?: "Documento Jinx"
            val contenido = args["contenido"] ?: return@AgentTool "Falta el argumento 'contenido'."
            val subtitulo = args["subtitulo"] ?: ""
            val filename = args["archivo"]?.replace(Regex("[^a-zA-Z0-9_-]"), "_") ?: "reporte_${System.currentTimeMillis()}"
            val safeName = if (filename.endsWith(".pdf")) filename else "$filename.pdf"

            try {
                val pdfDoc = PdfDocument()
                val pageWidth = 595
                val pageHeight = 842
                var pageNumber = 1

                var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                var page = pdfDoc.startPage(pageInfo)
                var canvas = page.canvas

                val paint = Paint().apply {
                    isAntiAlias = true
                }

                val marginX = 45f
                val contentWidth = pageWidth - marginX * 2
                var y = 60f

                // Barra superior decorativa
                paint.color = Color.BLACK
                canvas.drawRect(marginX, y, marginX + contentWidth, y + 4f, paint)
                y += 30f

                // Título
                paint.textSize = 20f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                paint.color = Color.BLACK
                canvas.drawText(titulo, marginX, y, paint)
                y += 24f

                // Subtítulo si existe
                if (subtitulo.isNotBlank()) {
                    paint.textSize = 12f
                    paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                    paint.color = Color.DKGRAY
                    canvas.drawText(subtitulo, marginX, y, paint)
                    y += 18f
                }

                // Metadatos
                paint.textSize = 9f
                paint.color = Color.GRAY
                val fecha = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                canvas.drawText("Jinx AI • Modo Offline  |  Fecha: $fecha", marginX, y, paint)
                y += 12f

                // Línea separadora
                paint.color = Color.LTGRAY
                paint.strokeWidth = 1f
                canvas.drawLine(marginX, y, marginX + contentWidth, y, paint)
                y += 25f

                // Contenido con salto de línea automático
                paint.textSize = 11f
                paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                paint.color = Color.DKGRAY

                val words = contenido.split(Regex("\\s+"))
                var currentLine = ""
                for (word in words) {
                    val testLine = if (currentLine.isEmpty()) word else "$currentLine $word"
                    val textWidth = paint.measureText(testLine)

                    if (textWidth > contentWidth) {
                        canvas.drawText(currentLine, marginX, y, paint)
                        y += 16f
                        currentLine = word

                        // Paginación si se llena la hoja
                        if (y > pageHeight - 60f) {
                            paint.textSize = 8f
                            paint.color = Color.GRAY
                            canvas.drawText("Página $pageNumber  |  Jinx AI Secured Offline", marginX, pageHeight - 30f, paint)

                            pdfDoc.finishPage(page)
                            pageNumber++
                            pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                            page = pdfDoc.startPage(pageInfo)
                            canvas = page.canvas
                            y = 60f

                            paint.textSize = 11f
                            paint.color = Color.DKGRAY
                        }
                    } else {
                        currentLine = testLine
                    }
                }
                if (currentLine.isNotEmpty()) {
                    canvas.drawText(currentLine, marginX, y, paint)
                }

                // Pie de página final
                paint.textSize = 8f
                paint.color = Color.GRAY
                canvas.drawText("Página $pageNumber  |  Jinx AI Secured Offline", marginX, pageHeight - 30f, paint)

                pdfDoc.finishPage(page)

                // Guardar archivo en almacenamiento accesible
                val dir = ctx.getExternalFilesDir(null) ?: ctx.filesDir
                val file = File(dir, safeName)
                FileOutputStream(file).use { out ->
                    pdfDoc.writeTo(out)
                }
                pdfDoc.close()

                // Intentar abrir el PDF con FileProvider
                try {
                    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.provider", file)
                    val openIntent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    ctx.startActivity(openIntent)
                } catch (_: Exception) {}

                "Documento PDF generado exitosamente: '${file.name}' (${file.length()} bytes) en almacenamiento local."
            } catch (e: Exception) {
                "Error al generar PDF: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "generar_csv",
        description = "Genera un archivo de hoja de cálculo CSV tabular y lo guarda en el teléfono. Argumentos: archivo, cabeceras (separadas por coma), datos (filas separadas por punto y coma o salto de línea).",
        permission = null,
        execute = { ctx, args ->
            val filename = args["archivo"]?.replace(Regex("[^a-zA-Z0-9_-]"), "_") ?: "datos_${System.currentTimeMillis()}"
            val cabeceras = args["cabeceras"] ?: return@AgentTool "Falta el argumento 'cabeceras'."
            val datos = args["datos"] ?: return@AgentTool "Falta el argumento 'datos'."
            val safeName = if (filename.endsWith(".csv")) filename else "$filename.csv"

            try {
                val dir = ctx.getExternalFilesDir(null) ?: ctx.filesDir
                val file = File(dir, safeName)
                val csvContent = buildString {
                    appendLine(cabeceras)
                    val rows = datos.split(Regex("[;\n]+"))
                    for (row in rows) {
                        if (row.isNotBlank()) appendLine(row.trim())
                    }
                }
                file.writeText(csvContent)

                try {
                    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.provider", file)
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/comma-separated-values"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    ctx.startActivity(Intent.createChooser(shareIntent, "Compartir CSV").apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                } catch (_: Exception) {}

                "Hoja de cálculo CSV generada: '${file.name}' (${file.length()} bytes)."
            } catch (e: Exception) {
                "Error al generar CSV: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "portapapeles_copiar",
        description = "Copia un texto al portapapeles del teléfono para pegarlo donde quieras. args: {\"texto\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val text = args["texto"] ?: args["text"] ?: args["contenido"] ?: ""
            if (text.isBlank()) return@AgentTool "ERROR: Falta el texto a copiar."
            try {
                val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                val clip = ClipData.newPlainText("Jinx Agent", text)
                cm?.setPrimaryClip(clip)
                "Texto copiado exitosamente al portapapeles (${text.length} caracteres)."
            } catch (e: Exception) {
                "ERROR al copiar al portapapeles: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "portapapeles_leer",
        description = "Lee el texto que el usuario tiene copiado en el portapapeles del teléfono. Sin argumentos.",
        permission = null,
        execute = { ctx, _ ->
            try {
                val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                val clip = cm?.primaryClip
                if (clip != null && clip.itemCount > 0) {
                    val text = clip.getItemAt(0)?.coerceToText(ctx)?.toString() ?: ""
                    if (text.isNotBlank()) "Texto en portapapeles (${text.length} caracteres):\n$text"
                    else "El portapapeles está vacío o no contiene texto."
                } else {
                    "El portapapeles está vacío."
                }
            } catch (e: Exception) {
                "ERROR al leer portapapeles: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "enviar_sms",
        description = "Prepara un mensaje SMS en la app de mensajes para enviar a un número. args: {\"numero\": \"+34...\", \"mensaje\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val num = (args["numero"] ?: args["number"] ?: args["telefono"] ?: "").filter { it.isDigit() || it == '+' }
            val msg = args["mensaje"] ?: args["message"] ?: args["texto"] ?: ""
            if (num.isBlank()) return@AgentTool "ERROR: Falta el número de teléfono."
            try {
                val intent = Intent(Intent.ACTION_SENDTO).apply {
                    data = Uri.parse("smsto:$num")
                    putExtra("sms_body", msg)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Mensaje SMS preparado para $num con texto: '$msg'."
            } catch (e: Exception) {
                "ERROR al abrir SMS: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "enviar_correo",
        description = "Prepara un correo electrónico en la app de correo. args: {\"destinatario\": \"...@...\", \"asunto\": \"...\", \"cuerpo\": \"...\"}.",
        permission = null,
        execute = { ctx, args ->
            val to = args["destinatario"] ?: args["email"] ?: args["correo"] ?: ""
            val sub = args["asunto"] ?: args["subject"] ?: "Nota desde Jinx"
            val body = args["cuerpo"] ?: args["body"] ?: args["mensaje"] ?: ""
            try {
                val intent = Intent(Intent.ACTION_SENDTO).apply {
                    data = Uri.parse("mailto:${Uri.encode(to)}")
                    putExtra(Intent.EXTRA_SUBJECT, sub)
                    putExtra(Intent.EXTRA_TEXT, body)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(intent)
                "Correo preparado para '$to' con asunto '$sub'."
            } catch (e: Exception) {
                "ERROR al abrir cliente de correo: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "abrir_mapa",
        description = "Abre un mapa o navegación GPS hacia una dirección, lugar o coordenadas. args: {\"lugar\": \"Plaza Mayor, Madrid\"}.",
        permission = null,
        execute = { ctx, args ->
            val place = args["lugar"] ?: args["direccion"] ?: args["sitio"] ?: args["query"] ?: ""
            val lat = args["latitud"] ?: args["lat"]
            val lon = args["longitud"] ?: args["lon"]
            val uri = if (!lat.isNullOrBlank() && !lon.isNullOrBlank()) {
                Uri.parse("geo:$lat,$lon?q=$lat,$lon(${Uri.encode(place.ifBlank { "Ubicación" })})")
            } else if (place.isNotBlank()) {
                Uri.parse("geo:0,0?q=${Uri.encode(place)}")
            } else {
                return@AgentTool "ERROR: Proporciona un 'lugar' o 'latitud' y 'longitud'."
            }
            try {
                val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                ctx.startActivity(mapIntent)
                "Mapa abierto buscando: '${place.ifBlank { "$lat, $lon" }}'."
            } catch (e: Exception) {
                "ERROR al abrir aplicación de mapas: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "reproducir_tono",
        description = "Emite un tono audible por el altavoz (alarma, beep, confirmación o error). args: {\"tipo\": \"beep|alarma|notificacion|error\"}.",
        permission = null,
        execute = { _, args ->
            val tipo = (args["tipo"] ?: args["type"] ?: "beep").lowercase()
            try {
                val toneType = when (tipo) {
                    "alarma" -> ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK
                    "notificacion" -> ToneGenerator.TONE_PROP_BEEP
                    "error" -> ToneGenerator.TONE_SUP_ERROR
                    else -> ToneGenerator.TONE_PROP_ACK
                }
                val tg = ToneGenerator(AudioManager.STREAM_ALARM, 85)
                tg.startTone(toneType, 400)
                "Tono sonoro de tipo '$tipo' emitido en el altavoz."
            } catch (e: Exception) {
                "ERROR al reproducir tono: ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "buscar_en_archivos",
        description = "Busca texto o palabras clave dentro de todos los documentos y notas guardados localmente. args: {\"termino\": \"palabra\"}.",
        permission = null,
        execute = { ctx, args ->
            val query = (args["termino"] ?: args["query"] ?: args["texto"] ?: "").lowercase().trim()
            if (query.isBlank()) return@AgentTool "ERROR: Especifica el término a buscar."
            val dir = ctx.filesDir
            val files = dir.listFiles()?.filter { it.isFile && !it.name.endsWith(".bin") } ?: emptyList()
            val matches = mutableListOf<String>()
            for (f in files) {
                try {
                    val content = f.readText()
                    if (content.lowercase().contains(query)) {
                        val preview = content.lineSequence().firstOrNull { it.lowercase().contains(query) }?.trim()?.take(100) ?: ""
                        matches.add("• [${f.name}]: \"$preview\"")
                    }
                } catch (_: Exception) {}
            }
            if (matches.isEmpty()) "No se encontraron coincidencias para '$query' en los archivos locales."
            else "Coincidencias encontradas (${matches.size}):\n" + matches.joinToString("\n")
        },
    ),
    AgentTool(
        name = "eliminar_archivo",
        description = "Elimina un archivo del almacenamiento local del teléfono. args: {\"nombre\": \"documento.txt\"}.",
        permission = null,
        execute = { ctx, args ->
            val name = args["nombre"]?.replace("[^a-zA-Z0-9._-]".toRegex(), "_") ?: return@AgentTool "Falta el nombre del archivo."
            val file = File(ctx.filesDir, name)
            if (!file.exists()) return@AgentTool "El archivo '$name' no existe."
            if (file.delete()) "Archivo '$name' eliminado con éxito."
            else "No se pudo eliminar el archivo '$name'."
        },
    ),
    AgentTool(
        name = "abrir_app",
        description = "Abre una aplicación instalada en el teléfono por su función. args: {\"app\": \"calculadora|camara|galeria|reloj|ajustes|navegador|calendario\"}.",
        permission = null,
        execute = { ctx, args ->
            val target = (args["app"] ?: args["nombre"] ?: "").lowercase().trim()
            try {
                val intent = when (target) {
                    "calculadora", "calculator" -> {
                        Intent().apply {
                            action = Intent.ACTION_MAIN
                            addCategory(Intent.CATEGORY_APP_CALCULATOR)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    "camara", "camera" -> {
                        Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    "galeria", "gallery", "fotos" -> {
                        Intent().apply {
                            action = Intent.ACTION_MAIN
                            addCategory(Intent.CATEGORY_APP_GALLERY)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    "reloj", "clock" -> {
                        Intent(AlarmClock.ACTION_SHOW_ALARMS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    "calendario", "calendar" -> {
                        Intent().apply {
                            action = Intent.ACTION_MAIN
                            addCategory(Intent.CATEGORY_APP_CALENDAR)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    "navegador", "browser" -> {
                        Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    "ajustes", "settings" -> {
                        Intent(Settings.ACTION_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    else -> {
                        val pm = ctx.packageManager
                        val launchIntent = pm.getLaunchIntentForPackage(target)
                        if (launchIntent != null) {
                            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            ctx.startActivity(launchIntent)
                            return@AgentTool "Aplicación '$target' iniciada."
                        }
                        return@AgentTool "No se reconoce la app '$target'. Opciones: calculadora, camara, galeria, reloj, calendario, navegador, ajustes."
                    }
                }
                ctx.startActivity(intent)
                "Aplicación '$target' abierta."
            } catch (e: Exception) {
                "ERROR al abrir '$target': ${e.message}"
            }
        },
    ),
    AgentTool(
        name = "resumen_sistema_pro",
        description = "Especificaciones completas de hardware del dispositivo (modelo, CPU, núcleos, arquitectura, pantalla, versión Android). Sin argumentos.",
        permission = null,
        execute = { ctx, _ ->
            val dm = ctx.resources.displayMetrics
            val cores = Runtime.getRuntime().availableProcessors()
            val arch = Build.SUPPORTED_ABIS.joinToString(", ")
            val model = "${Build.MANUFACTURER} ${Build.MODEL}"
            val sdk = "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})"
            val uptimeHours = android.os.SystemClock.elapsedRealtime() / (1000.0 * 3600.0)
            """
            ESPECIFICACIONES DE HARDWARE:
            • Dispositivo: $model
            • Sistema Operativo: $sdk
            • Procesador: $cores núcleos de CPU | Arquitectura: $arch
            • Pantalla: ${dm.widthPixels}x${dm.heightPixels} px (${dm.densityDpi} dpi)
            • Tiempo de actividad: ${"%.1f".format(uptimeHours)} horas continuas
            """.trimIndent()
        },
    ),
)

/** Evaluador seguro de expresiones matemáticas locales. */
private fun evaluateMathExpression(expr: String): Double {
    val tokens = expr.replace(" ", "")
    return object : Any() {
        var pos = -1
        var ch = 0

        fun nextChar() {
            ch = if (++pos < tokens.length) tokens[pos].code else -1
        }

        fun eat(charToEat: Int): Boolean {
            while (ch == ' '.code) nextChar()
            if (ch == charToEat) {
                nextChar()
                return true
            }
            return false
        }

        fun parse(): Double {
            nextChar()
            val x = parseExpression()
            if (pos < tokens.length) throw RuntimeException("Carácter inesperado: ${ch.toChar()}")
            return x
        }

        fun parseExpression(): Double {
            var x = parseTerm()
            while (true) {
                when {
                    eat('+'.code) -> x += parseTerm()
                    eat('-'.code) -> x -= parseTerm()
                    else -> return x
                }
            }
        }

        fun parseTerm(): Double {
            var x = parseFactor()
            while (true) {
                when {
                    eat('*'.code) -> x *= parseFactor()
                    eat('/'.code) -> x /= parseFactor()
                    eat('%'.code) -> x %= parseFactor()
                    else -> return x
                }
            }
        }

        fun parseFactor(): Double {
            if (eat('+'.code)) return parseFactor()
            if (eat('-'.code)) return -parseFactor()

            var x: Double
            val startPos = pos
            if (eat('('.code)) {
                x = parseExpression()
                eat(')'.code)
            } else if ((ch in '0'.code..'9'.code) || ch == '.'.code) {
                while ((ch in '0'.code..'9'.code) || ch == '.'.code) nextChar()
                x = tokens.substring(startPos, pos).toDouble()
            } else if (ch in 'a'.code..'z'.code) {
                while (ch in 'a'.code..'z'.code) nextChar()
                val func = tokens.substring(startPos, pos)
                x = parseFactor()
                x = when (func) {
                    "sqrt" -> kotlin.math.sqrt(x)
                    "sin" -> kotlin.math.sin(Math.toRadians(x))
                    "cos" -> kotlin.math.cos(Math.toRadians(x))
                    "tan" -> kotlin.math.tan(Math.toRadians(x))
                    "abs" -> kotlin.math.abs(x)
                    else -> throw RuntimeException("Función: $func")
                }
            } else {
                throw RuntimeException("Carácter inesperado: ${ch.toChar()}")
            }

            if (eat('^'.code)) x = Math.pow(x, parseFactor())
            return x
        }
    }.parse()
}

/** Permisos peligrosos que el agente puede pedir, con explicación. */
val AGENT_PERMISSIONS: List<Pair<String, String>> = listOf(
    Manifest.permission.ACCESS_FINE_LOCATION to "Ubicación: para decirte dónde estás.",
    Manifest.permission.CAMERA to "Cámara: solo para encender la linterna.",
)

/** Herramientas bloqueadas por falta de permiso (para mostrar estado). */
fun blockedTools(ctx: Context): List<AgentTool> =
    agentTools().filter { it.permission != null && !hasPermission(ctx, it.permission) }
