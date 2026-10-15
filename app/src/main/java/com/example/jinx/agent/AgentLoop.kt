package com.example.jinx.agent

import android.content.Context
import android.util.Log
import com.example.jinx.llama.LlamaEngine
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/** Paso visible del agente (para la UI). */
data class AgentStep(
    val kind: Kind,
    val text: String,
) {
    enum class Kind { THINKING, TOOL, RESULT, FINAL, ERROR }
}

private const val MAX_STEPS = 6

/** Mapa de alias y sinónimos comunes para asegurar que modelos locales llamen las herramientas correctas. */
private val TOOL_ALIASES = mapOf(
    "flashlight" to "linterna",
    "torch" to "linterna",
    "time" to "hora",
    "date" to "hora",
    "fecha" to "hora",
    "hora_actual" to "hora",
    "device_info" to "info_dispositivo",
    "bateria" to "info_dispositivo",
    "battery" to "info_dispositivo",
    "dispositivo" to "info_dispositivo",
    "location" to "ubicacion",
    "gps" to "ubicacion",
    "geo" to "ubicacion",
    "device_location" to "ubicacion",
    "vibrate" to "vibrar",
    "tts" to "hablar",
    "speak" to "hablar",
    "voz" to "hablar",
    "timer" to "temporizador",
    "set_timer" to "temporizador",
    "open_url" to "abrir_url",
    "browse" to "abrir_url",
    "navegador" to "abrir_url",
    "call" to "llamar",
    "dial" to "llamar",
    "telefono" to "llamar",
    "phone" to "llamar",
    "camera" to "abrir_camara",
    "camara" to "abrir_camara",
    "save_file" to "guardar_archivo",
    "create_file" to "guardar_archivo",
    "escribir_archivo" to "guardar_archivo",
    "alarm" to "alarma",
    "set_alarm" to "alarma",
    "calendar" to "calendario_evento",
    "evento" to "calendario_evento",
    "calendar_event" to "calendario_evento",
    "read_file" to "leer_archivo",
    "cat" to "leer_archivo",
    "list_files" to "listar_archivos",
    "ls" to "listar_archivos",
    "archivos" to "listar_archivos",
    "network" to "estado_red",
    "red" to "estado_red",
    "wifi" to "estado_red",
    "connectivity" to "estado_red",
    "calculator" to "calculadora_nativa",
    "calcular" to "calculadora_nativa",
    "calculadora" to "calculadora_nativa",
    "math" to "calculadora_nativa",
    "eval" to "calculadora_nativa",
    "settings" to "abrir_ajustes",
    "ajustes" to "abrir_ajustes",
    "configuracion" to "abrir_ajustes",
    "share" to "compartir_texto",
    "compartir" to "compartir_texto",
    "script" to "ejecutar_script",
    "run_script" to "ejecutar_script",
    "run_python" to "ejecutar_script",
    "stats" to "estadisticas_y_algebra",
    "algebra" to "estadisticas_y_algebra",
    "estadisticas" to "estadisticas_y_algebra",
    "clipboard_copy" to "portapapeles_copiar",
    "copiar" to "portapapeles_copiar",
    "copy" to "portapapeles_copiar",
    "clipboard" to "portapapeles_copiar",
    "portapapeles" to "portapapeles_copiar",
    "clipboard_read" to "portapapeles_leer",
    "leer_portapapeles" to "portapapeles_leer",
    "pegar" to "portapapeles_leer",
    "paste" to "portapapeles_leer",
    "sms" to "enviar_sms",
    "send_sms" to "enviar_sms",
    "mensaje_texto" to "enviar_sms",
    "email" to "enviar_correo",
    "mail" to "enviar_correo",
    "correo" to "enviar_correo",
    "send_email" to "enviar_correo",
    "map" to "abrir_mapa",
    "maps" to "abrir_mapa",
    "mapa" to "abrir_mapa",
    "gps_map" to "abrir_mapa",
    "beep" to "reproducir_tono",
    "tono" to "reproducir_tono",
    "sonar" to "reproducir_tono",
    "alert_sound" to "reproducir_tono",
    "buscar_archivos" to "buscar_en_archivos",
    "search_files" to "buscar_en_archivos",
    "grep" to "buscar_en_archivos",
    "borrar_archivo" to "eliminar_archivo",
    "delete_file" to "eliminar_archivo",
    "rm" to "eliminar_archivo",
    "app" to "abrir_app",
    "open_app" to "abrir_app",
    "lanzar_app" to "abrir_app",
    "specs" to "resumen_sistema_pro",
    "hardware" to "resumen_sistema_pro",
    "hardware_specs" to "resumen_sistema_pro",
    "sistema_pro" to "resumen_sistema_pro",
    "create_code" to "create_code",
    "crear_codigo" to "create_code",
    "generar_codigo" to "create_code",
    "code" to "create_code"
)

fun selectRelevantTools(allTools: List<AgentTool>, task: String): List<AgentTool> {
    val lower = task.lowercase()
    val matched = allTools.filter { tool ->
        lower.contains(tool.name) ||
        (tool.name == "create_code" && (lower.contains("codigo") || lower.contains("código") || lower.contains("html") || lower.contains("script") || lower.contains("calculadora") || lower.contains("app") || lower.contains("pagina") || lower.contains("página") || lower.contains("crea") || lower.contains("genera") || lower.contains("hazme"))) ||
        (tool.name == "info_dispositivo" && (lower.contains("bateria") || lower.contains("batería") || lower.contains("hardware") || lower.contains("ram") || lower.contains("recurso") || lower.contains("almacenamiento") || lower.contains("sistema") || lower.contains("espacio"))) ||
        (tool.name == "hora" && (lower.contains("hora") || lower.contains("fecha") || lower.contains("dia") || lower.contains("día") || lower.contains("tiempo"))) ||
        (tool.name == "ubicacion" && (lower.contains("ubicacion") || lower.contains("ubicación") || lower.contains("gps") || lower.contains("donde") || lower.contains("dónde"))) ||
        (tool.name == "linterna" && (lower.contains("linterna") || lower.contains("luz") || lower.contains("torch") || lower.contains("flash"))) ||
        (tool.name == "estado_red" && (lower.contains("red") || lower.contains("wifi") || lower.contains("internet") || lower.contains("conexion") || lower.contains("conexión"))) ||
        (tool.name == "vibrar" && lower.contains("vibra")) ||
        (tool.name == "hablar" && (lower.contains("habla") || lower.contains("voz") || lower.contains("di "))) ||
        (tool.name == "temporizador" && (lower.contains("temporizador") || lower.contains("timer") || lower.contains("cuenta regresiva"))) ||
        (tool.name == "alarma" && lower.contains("alarma")) ||
        (tool.name == "calculadora_nativa" && (lower.contains("calcula") || lower.contains("suma") || lower.contains("multiplica") || lower.contains("divide") || lower.contains("porcentaje")))
    }
    return if (matched.isNotEmpty()) {
        matched.take(5)
    } else {
        allTools.filter { it.name in listOf("info_dispositivo", "hora", "ubicacion", "estado_red", "calculadora_nativa") }
    }
}

private fun toolsPrompt(tools: List<AgentTool>): String {
    val sb = StringBuilder()
    sb.append("Jinx offline. Responde SIEMPRE con un único JSON:\n")
    sb.append("1. Usar herramienta: {\"tool\": \"nombre\", \"args\": {}}\n")
    sb.append("2. Respuesta final: {\"final\": \"texto completo\"}\n\n")
    sb.append("Herramientas disponibles:\n")
    for (t in tools) sb.append("• ").append(t.name).append(": ").append(t.description).append("\n")
    return sb.toString()
}

/** Generación bloqueante con chequeo reactivo de cancelación cada 250ms. */
private fun generateSync(prompt: String, maxTokens: Int, isCancelled: () -> Boolean): String {
    if (isCancelled()) return ""
    var out = ""
    val latch = CountDownLatch(1)
    LlamaEngine.generate(
        prompt,
        maxTokens,
        onToken = {
            if (isCancelled()) {
                LlamaEngine.stop()
                latch.countDown()
            }
        },
        onDone = { full ->
            out = full
            latch.countDown()
        },
        onError = { err ->
            out = "[error: $err]"
            latch.countDown()
        }
    )
    while (!latch.await(250, TimeUnit.MILLISECONDS)) {
        if (isCancelled()) {
            LlamaEngine.stop()
            break
        }
    }
    return out
}

/** Extrae todos los objetos JSON válidos del texto de forma segura respecto a comillas y escapes. */
private fun extractJsonObjects(text: String): List<JSONObject> {
    val results = mutableListOf<JSONObject>()
    val cleaned = text.trim()
    var depth = 0
    var start = -1
    var inString = false
    var escape = false

    for (i in cleaned.indices) {
        val c = cleaned[i]
        if (escape) {
            escape = false
            continue
        }
        if (c == '\\') {
            escape = true
            continue
        }
        if (c == '"') {
            inString = !inString
            continue
        }
        if (!inString) {
            if (c == '{') {
                if (depth == 0) start = i
                depth++
            } else if (c == '}') {
                depth--
                if (depth == 0 && start >= 0) {
                    val candidate = cleaned.substring(start, i + 1)
                    try {
                        results.add(JSONObject(candidate))
                    } catch (_: Exception) {
                        // ignorar fragmentos inválidos
                    }
                    start = -1
                }
                if (depth < 0) depth = 0
            }
        }
    }
    return results
}

/** Representación parseada de una llamada a herramienta. */
private data class ParsedTool(
    val name: String,
    val args: Map<String, String>
)

/** Detecta si un JSONObject contiene una llamada a herramienta con nombres o parámetros flexibles. */
private fun extractToolCall(obj: JSONObject): ParsedTool? {
    val toolKey = listOf("tool", "action", "function", "tool_name", "call").firstOrNull { obj.has(it) } ?: return null
    val rawName = obj.optString(toolKey).trim()
    if (rawName.isBlank()) return null
    val normalizedName = TOOL_ALIASES[rawName.lowercase()] ?: rawName.lowercase()

    val args = mutableMapOf<String, String>()
    val nestedObj = listOf("args", "parameters", "arguments", "params").mapNotNull { obj.optJSONObject(it) }.firstOrNull()
    if (nestedObj != null) {
        for (k in nestedObj.keys()) {
            args[k] = nestedObj.optString(k)
        }
    }
    // Incluir argumentos planos pasados directamente en el root del objeto
    val reservedKeys = setOf("tool", "action", "function", "tool_name", "call", "args", "parameters", "arguments", "params", "thought", "reasoning", "explanation")
    for (k in obj.keys()) {
        if (!reservedKeys.contains(k.lowercase()) && !args.containsKey(k)) {
            args[k] = obj.optString(k)
        }
    }
    return ParsedTool(normalizedName, args)
}

/** Detecta si un JSONObject contiene la respuesta final para el usuario. */
private fun extractFinalAnswer(obj: JSONObject): String? {
    val finalKey = listOf("final", "response", "answer", "output", "mensaje", "result").firstOrNull { obj.has(it) } ?: return null
    val ans = obj.optString(finalKey).trim()
    return ans.ifBlank { null }
}

/**
 * Bucle ReAct robusto: el modelo decide herramientas, se ejecutan en el teléfono y
 * el resultado vuelve al modelo hasta la respuesta final sin cancelaciones prematuras.
 */
fun runAgent(
    ctx: Context,
    userTask: String,
    onStep: (AgentStep) -> Unit,
    isCancelled: () -> Boolean,
): String {
    val tools = selectRelevantTools(agentTools(), userTask)
    val history = StringBuilder()
    history.append("Tarea del usuario: ").append(userTask).append("\n")

    for (step in 0 until MAX_STEPS) {
        if (isCancelled()) return "Cancelado por el usuario."
        onStep(AgentStep(AgentStep.Kind.THINKING, "Paso ${step + 1}: analizando tarea…"))
        val prompt = toolsPrompt(tools) + "\n\nHistorial de ejecución:\n" + history.toString().takeLast(1600)
        val raw = generateSync(prompt, 512, isCancelled).trim()

        if (isCancelled()) return "Cancelado por el usuario."
        if (raw.isBlank() || raw.startsWith("[error:")) {
            history.append("Sistema: No se generó respuesta válida o el motor se detuvo.\n")
            continue
        }

        val jsonObjects = extractJsonObjects(raw)
        var executedTool = false

        // 1. Priorizar llamada a herramienta si está presente
        for (obj in jsonObjects) {
            val toolCall = extractToolCall(obj)
            if (toolCall != null) {
                val tool = tools.firstOrNull { it.name.equals(toolCall.name, ignoreCase = true) }
                if (tool == null) {
                    val msg = "Herramienta desconocida '${toolCall.name}'."
                    history.append("Sistema: ").append(msg).append(" Consulta la lista de herramientas disponibles.\n")
                    onStep(AgentStep(AgentStep.Kind.ERROR, msg))
                    executedTool = true
                    break
                }
                if (tool.permission != null && !hasPermission(ctx, tool.permission)) {
                    val msg = "ERROR: Permiso no concedido para '${tool.name}'. Pídele al usuario que lo conceda."
                    history.append("Sistema: ").append(msg).append("\n")
                    onStep(AgentStep(AgentStep.Kind.ERROR, msg))
                    executedTool = true
                    break
                }

                onStep(AgentStep(AgentStep.Kind.TOOL, "Ejecutando: ${tool.name} ${toolCall.args}"))
                val result = try {
                    tool.execute(ctx, toolCall.args)
                } catch (e: Exception) {
                    "ERROR: ${e.message}"
                }
                onStep(AgentStep(AgentStep.Kind.RESULT, result.take(500)))
                history.append("Llamada: ").append(tool.name).append(" ").append(toolCall.args).append("\n")
                history.append("Resultado: ").append(result.take(800)).append("\n")
                executedTool = true
                break
            }
        }

        if (executedTool) {
            continue
        }

        // Fallback: Si el modelo generó un bloque de código directamente (típico en LlamaCppEngine)
        val codeFenceRegex = Regex("```([a-zA-Z0-9_-]*)\\s*\\n([\\s\\S]*?)```")
        val codeMatch = codeFenceRegex.findAll(raw).maxByOrNull { it.groupValues[2].length }
        if (codeMatch != null && tools.any { it.name == "create_code" }) {
            val fenceLang = codeMatch.groupValues[1].lowercase()
            val codeBody = codeMatch.groupValues[2].trim()
            val detectedLang = when {
                fenceLang in listOf("html", "htm") || codeBody.contains("<html", true) || codeBody.contains("<!doctype", true) -> "html"
                fenceLang in listOf("python", "py") || codeBody.contains("def ") || codeBody.contains("import ") -> "python"
                else -> "javascript"
            }
            onStep(AgentStep(AgentStep.Kind.TOOL, "Ejecutando: create_code {title='Código generado', language='$detectedLang'}"))
            val result = try {
                com.example.jinx.llama.NodoBridge.openCodeTab(codeBody, detectedLang, "Código generado")
                "Código '$detectedLang' generado y abierto en Code Studio Pro."
            } catch (e: Exception) {
                "Error al abrir código: ${e.message}"
            }
            onStep(AgentStep(AgentStep.Kind.RESULT, result))
            onStep(AgentStep(AgentStep.Kind.FINAL, result))
            return result
        }

        // 2. Verificar si es una respuesta final
        for (obj in jsonObjects) {
            val answer = extractFinalAnswer(obj)
            if (!answer.isNullOrBlank()) {
                onStep(AgentStep(AgentStep.Kind.FINAL, answer))
                return answer
            }
        }

        // 3. Si no hay JSON estructurado:
        // Si es el último paso, usamos la respuesta libre
        if (step == MAX_STEPS - 1) {
            val clean = raw.replace(Regex("```(?:json)?|```"), "").trim()
            onStep(AgentStep(AgentStep.Kind.FINAL, clean))
            return clean
        }

        // Si el modelo habló sin JSON en un paso intermedio:
        // Guiarlo a que genere la acción o conclusión en lugar de abortar
        history.append("Modelo: ").append(raw.take(250)).append("\n")
        history.append("Sistema: Responde ÚNICAMENTE en JSON con {\"tool\": \"...\", \"args\": {...}} o {\"final\": \"...\"}.\n")
        onStep(AgentStep(AgentStep.Kind.THINKING, "Alineando formato del agente…"))
    }

    return "Tarea procesada tras $MAX_STEPS pasos."
}
