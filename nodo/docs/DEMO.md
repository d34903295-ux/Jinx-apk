# Guion de Demostración — Jinx (Hack47 OFFGRID)

Este documento es la guía paso a paso para la demostración en video o presentación en vivo de **Jinx** ante el jurado del hackathon.

---

## ⏱️ Duración Recomendada: 3 Minutos

### Escena 1: El Problema y Desconexión Total (0:00 - 0:30)
- **Acción:** Muestra el dispositivo móvil o el navegador con la aplicación Jinx abierta.
- **Demostración de Red:** Activa el **Modo Avión** en el teléfono o desactiva la conexión Wi-Fi/Ethernet en el navegador. Abre una pestaña nueva y muestra que Google o ChatGPT no cargan ("Sin conexión").
- **Voz en Off / Mensaje:** *"En una catástrofe natural, rescate en montaña o en medio del océano, no hay internet. La IA en la nube es inútil. Les presento Jinx: un agente inteligente 100% soberano y local que opera completamente desconectado."*

---

### Escena 2: Asistente y Conversación Base (0:30 - 1:00)
- **Acción:**
  - Muestra el estado del badge superior: `OFFLINE · LOCAL GPU (Llama-3.2-1B-Instruct)`.
  - Envía una consulta: *"Explícame cómo funciona una brújula solar casera con un palo y el sol."*
  - Observa la generación rápida y fluida token a token mediante WebGPU sin enviar ningún paquete a la red.
- **Puntos a Destacar:**
  - Aceleración por WebGPU.
  - Streaming a 60 FPS sin ralentizar la interfaz gracias a Web Workers.

---

### Escena 3: Document RAG con Citaciones Interactivas (1:00 - 1:45)
- **Acción:**
  - Pulsa en el botón **Docs** para abrir la `LibraryView`.
  - Muestra la subida de un documento PDF (ej. manual técnico o guía de rescate).
  - Observa la barra de progreso de indexación vectorial (embeddings calculados 100% offline en el dispositivo con `all-MiniLM-L6-v2`).
  - Pulsa en **Preguntar al documento** o vuelve al chat y pregunta: *"¿Cuáles son los pasos según el manual para tratar una hipotermia de grado 2?"*
  - Muestra la respuesta generada con badges de citación `[1]`, `[2]`.
  - **Haz clic en el badge `[1]`:** Muestra el popover flotante con el texto exacto citado, el nombre del documento y el número de página.
- **Puntos a Destacar:**
  - Experiencia equivalente a NotebookLM, pero ejecutándose 100% en la RAM del teléfono sin servidor.

---

### Escena 4: Agente Autónomo y Ejecución de Código Python (1:45 - 2:20)
- **Acción:**
  - Activa el toggle **Modo Agente**.
  - Escribe una instrucción compleja: *"Calcula los primeros 10 números de Fibonacci usando un script de Python y guarda el resultado en mis notas personales."*
  - Observa las tarjetas colapsables `ToolCallCard`:
    1. Tarjeta `run_python` ejecutándose y completándose en verde con la salida capturada de Pyodide.
    2. Tarjeta `save_note` guardando la nota en IndexedDB.
    3. Respuesta sintética del agente confirmando la operación.
  - Navega a **Notas** y muestra la nota recién creada en tiempo real.
- **Puntos a Destacar:**
  - Entorno de ejecución Python completo en WebAssembly (Pyodide).
  - Watchdog de seguridad de 15 segundos contra bucles infinitos.
  - Parser matemático seguro sin `eval()`.

---

### Escena 5: Pack de Supervivencia y Ajustes (2:20 - 2:45)
- **Acción:**
  - Ve a la biblioteca y muestra el botón **Descargar Pack de Emergencia**.
  - Muestra cómo se indexan automáticamente los manuales de Primeros Auxilios, Purificación de Agua y Refugio.
  - Abre el panel de **Ajustes** (icono de engranaje):
    - Muestra la cuota de almacenamiento utilizada y disponible.
    - Muestra los modelos compatibles disponibles para descargar.
    - Demuestra el cambio fluido de tema Dark / Light.

---

### Escena 6: Conclusión y Cierre (2:45 - 3:00)
- **Voz en Off / Mensaje:** *"NODO transforma cualquier dispositivo móvil convencional en un nodo de inteligencia autónoma indestructible. No requiere servidores, respeta la privacidad absoluta y está listo para salvar vidas off-grid. Muchas gracias."*
- **Pantalla Final:** Logotipo de NODO, enlace al repositorio GitHub y créditos del equipo Hack47 OFFGRID.
