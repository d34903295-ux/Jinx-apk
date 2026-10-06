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

private const val MAX_STEPS = 5

private fun toolsPrompt(tools: List<AgentTool>): String {
    val sb = StringBuilder()
    sb.append("Eres NODO, un agente en un teléfono Android. ")
    sb.append("Responde SIEMPRE con una sola línea JSON, sin texto fuera:\n")
    sb.append("Para usar una herramienta: {\"tool\": \"nombre\", \"args\": {\"clave\": \"valor\"}}\n")
    sb.append("Para responder al usuario: {\"final\": \"tu respuesta\"}\n")
    sb.append("Herramientas disponibles:\n")
    for (t in tools) sb.append("- ").append(t.name).append(": ").append(t.description).append("\n")
    sb.append("Si la tarea no necesita herramientas, responde directamente con {\"final\": ...}. ")
    sb.append("Máximo ").append(MAX_STEPS).append(" pasos.")
    return sb.toString()
}

/** Generación bloqueante (para el hilo del agente). */
private fun generateSync(prompt: String, maxTokens: Int): String {
    var out = ""
    val latch = CountDownLatch(1)
    LlamaEngine.generate(
        prompt,
        maxTokens,
        onToken = {},
        onDone = { full ->
            out = full
            latch.countDown()
        },
    )
    latch.await(10, TimeUnit.MINUTES)
    return out
}

/**
 * Bucle ReAct: el modelo decide herramientas, se ejecutan en el teléfono y
 * el resultado vuelve al modelo hasta la respuesta final.
 */
fun runAgent(
    ctx: Context,
    userTask: String,
    onStep: (AgentStep) -> Unit,
    isCancelled: () -> Boolean,
): String {
    val tools = agentTools()
    val history = StringBuilder()
    history.append("Tarea del usuario: ").append(userTask).append("\n")

    repeat(MAX_STEPS) { step ->
        if (isCancelled()) return "Cancelado por el usuario."
        onStep(AgentStep(AgentStep.Kind.THINKING, "Paso ${step + 1}: pensando…"))
        val prompt = toolsPrompt(tools) + "\nHistorial:\n" + history.toString().takeLast(1500)
        val raw = generateSync(prompt, 256).trim()

        val toolJson = extractJsonWithKey(raw, "tool")
        if (toolJson != null) {
            try {
                val name = toolJson.getString("tool")
                val argsObj = toolJson.optJSONObject("args") ?: JSONObject()
                val args = mutableMapOf<String, String>()
                for (k in argsObj.keys()) args[k] = argsObj.optString(k)
                val tool = tools.firstOrNull { it.name == name }
                if (tool == null) {
                    history.append("Sistema: herramienta desconocida '$name'.\n")
                    onStep(AgentStep(AgentStep.Kind.ERROR, "Herramienta desconocida: $name"))
                    return@repeat
                }
                if (tool.permission != null && !hasPermission(ctx, tool.permission)) {
                    val msg = "ERROR: permiso no concedido para '${tool.name}'. Pídele al usuario que lo conceda en Habilidades."
                    history.append("Sistema: ").append(msg).append("\n")
                    onStep(AgentStep(AgentStep.Kind.ERROR, msg))
                    return@repeat
                }
                onStep(AgentStep(AgentStep.Kind.TOOL, "Ejecutando: ${tool.name} $args"))
                val result = try {
                    tool.execute(ctx, args)
                } catch (e: Exception) {
                    "ERROR: ${e.message}"
                }
                onStep(AgentStep(AgentStep.Kind.RESULT, result.take(400)))
                history.append("Llamada: ").append(name).append(" ").append(args).append("\n")
                history.append("Resultado: ").append(result.take(500)).append("\n")
                return@repeat
            } catch (e: Exception) {
                Log.e("NODO_AGENT", "parse error", e)
                history.append("Sistema: formato inválido, usa el JSON exacto.\n")
                return@repeat
            }
        }

        val finalJson = extractJsonWithKey(raw, "final")
        val answer = if (finalJson != null) {
            finalJson.optString("final", raw)
        } else {
            raw
        }
        if (answer.isNotBlank()) {
            onStep(AgentStep(AgentStep.Kind.FINAL, answer))
            return answer
        }
        history.append("Sistema: respuesta vacía, intenta de nuevo.\n")
    }
    return "No pude completar la tarea en $MAX_STEPS pasos."
}

/** Extrae el primer objeto JSON que contenga la clave dada. */
private fun extractJsonWithKey(text: String, key: String): JSONObject? {
    var depth = 0
    var start = -1
    for (i in text.indices) {
        when (text[i]) {
            '{' -> {
                if (depth == 0) start = i
                depth++
            }
            '}' -> {
                depth--
                if (depth == 0 && start >= 0) {
                    try {
                        val obj = JSONObject(text.substring(start, i + 1))
                        if (obj.has(key)) return obj
                    } catch (_: Exception) {
                    }
                    start = -1
                }
                if (depth < 0) depth = 0
            }
        }
    }
    return null
}
