# GEMINI.md

## Regla de Oro: Ahorro Extremo de Tokens con Graphify

Este proyecto cuenta con un grafo de conocimiento generado en `graphify-out/`.
Para optimizar la ventana de contexto y **ahorrar más del 80% de tokens** en cada interacción:

1. **PROHIBIDO leer archivos completos** para entender cómo funciona el proyecto o buscar clases/métodos.
2. **OBLIGATORIO usar Graphify primero:**
   - Para saber qué hace o dónde está una clase/función: `graphify explain "<Nombre>"`
   - Para ver la relación o llamada entre dos módulos: `graphify path "<A>" "<B>"`
   - Para responder preguntas de flujo o arquitectura: `graphify query "<pregunta>"`
3. **Lectura quirúrgica:** Cuando necesites leer código, lee únicamente el rango específico de líneas indicado en el grafo (`loc=Lxx`), no el archivo entero.
4. **Al modificar código:** Ejecuta siempre `graphify update .` (toma 1 segundo y no gasta tokens LLM).
