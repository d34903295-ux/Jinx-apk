# NODO — 100% Offline AI Agent 🌐🚫

> **Proyecto para Hack47 OFFGRID (Deadline: 15 de Octubre, 2026)**  
> *Tu copiloto de inteligencia artificial autónomo, privado y 100% local en tu bolsillo, sin conexión a internet ni servidores externos.*

---

## 🎯 Visión y Problema

En situaciones de emergencia, misiones humanitarias, navegación marítima, expediciones en zonas remotas o catástrofes naturales, la conectividad a internet desaparece por completo. Sin embargo, es precisamente en esos momentos críticos donde el acceso a conocimiento estructurado, cálculo analítico y asistencia inteligente se vuelve vital.

La mayoría de los agentes de IA actuales son dependientes de la nube (OpenAI, Anthropic, Gemini). Si no hay señal 4G/5G ni satélite, la IA queda inútil.

**NODO** resuelve esto de raíz:
- **Descárgalo una sola vez** mientras tengas conexión (PWA o APK Android).
- **Funciona para siempre desconectado:** El modelo LLM, los embeddings, la base de datos vectorial, el motor de ejecución de código Python y las herramientas se ejecutan **100% dentro del dispositivo del usuario** vía WebGPU, WebAssembly y Workers en segundo plano.
- **0 APIs, 0 Telemetría, 0 Costes por Token.**

---

## ✨ Características Principales

### 🧠 1. Inferencia Local con WebLLM & WebGPU
- Modelos optimizados en cuantización de 4 bits (MLC-AI):
  - **Llama-3.2-1B-Instruct-q4f32_1-MLC** (Rápido, equilibrado, ideal móviles modernos).
  - **Qwen2.5-1.5B-Instruct-q4f16_1-MLC** (Gran precisión en español y razonamiento).
  - **SmolLM2-360M-Instruct-q4f16_1-MLC** (Ultra ligero para dispositivos de bajos recursos).
  - **Llama-3.2-3B-Instruct-q4f16_1-MLC** (Máxima capacidad analítica).
- Inferencia acelerada por hardware nativo en un **Web Worker dedicado (`llm.worker.ts`)**, garantizando 60 FPS en la interfaz de usuario.
- Detección automática de hardware (WebGPU, núcleos lógicos, VRAM estimada).

### 📚 2. RAG Local Estilo NotebookLM con Citaciones Clicables
- **Ingesta de Documentos Offline:** Soporte para PDF (`pdfjs-dist`), Word DOCX (`mammoth`), TXT y Markdown.
- **Embeddings en el Dispositivo:** Generación de vectores densos usando `@huggingface/transformers` y ONNX Runtime Web (`all-MiniLM-L6-v2`) en Web Worker (`embed.worker.ts`).
- **Chunking inteligente:** Segmentación de 500 tokens con traslape (overlap) de 80 tokens preservando metadatos de documento y página.
- **Búsqueda Vectorial Offline:** Similitud coseno directamente sobre Dexie (IndexedDB).
- **Citaciones Interactivas `[1]`, `[2]`:** Al hacer clic en una cita, un popover flotante muestra el fragmento exacto, el nombre del documento y la página de origen.
- **Resumen Map-Reduce:** Capacidad de condensar libros y manuales extensos sin saturar la ventana de contexto.

### 🤖 3. Loop Autónomo de Agente y Herramientas (Tool Calling)
El agente razona, planifica y ejecuta acciones autónomamente (hasta 5 iteraciones con auto-recuperación de errores):
1. **Calculadora Segura:** Parser de descenso recursivo matemático sin `eval()` que evalúa expresiones complejas (`sqrt`, trigonometría, potencias, logaritmos).
2. **Python Offline en WebAssembly (Pyodide):** Ejecución de scripts de análisis numérico, algoritmos y procesamiento con watchdog timer de 15 segundos que evita bucles infinitos.
3. **Búsqueda en Biblioteca (RAG):** El agente consulta sus propios documentos indexados cuando detecta preguntas específicas.
4. **Resumen de Documentos:** Invocación automática de Map-Reduce.
5. **Notas Personales:** Creación, lectura y gestión de notas desde el chat.
6. **Tarjetas de Herramienta Colapsables (`ToolCallCard`):** Vista transparente en el chat que detalla la herramienta invocada, parámetros de entrada, estado (ejecutando / éxito / error) y resultado.

### 🆘 4. Pack de Supervivencia y Emergencias Pre-cargado
- Instalador en 1 clic de manuales de emergencia:
  - **Primeros Auxilios:** Protocolo PAS, RCP, atragantamiento, hemorragias, fracturas y shock.
  - **Purificación de Agua:** Métodos de ebullición, cloración de campaña, filtro de arena/carbón y radiación SODIS.
  - **Refugio y Señales:** Construcción contra frío/humedad, señales de auxilio SOS y espejo.
- *Descargo de responsabilidad médica visible y obligatorio en todas las respuestas de emergencia.*

### 📝 5. Bloc de Notas Offline Integrado
- CRUD completo de notas personales almacenadas en IndexedDB.
- Búsqueda en tiempo real por título y contenido.
- Transferencia fluida "Consultar IA" con un solo toque hacia el chat.

### ⚙️ 6. Centro de Control y Ajustes
- Selector y descarga de modelos adicionales con barra de progreso en vivo.
- Purga de modelos de la caché para liberar almacenamiento.
- Monitor de cuota de almacenamiento (`navigator.storage.estimate`).
- Activación de persistencia de datos del navegador (`navigator.storage.persist`).
- Selector de tema (Dark / Light) con diseño Glassmorphism pulido.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                       NODO FRONTEND                         │
│             React 19 + Tailwind CSS + Lucide Icons          │
│        (ChatView | LibraryView | NotesView | Settings)      │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     Comandos y Streaming           Lectura y Persistencia
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      WEB WORKERS POOL        │ │    STORAGE & INDEXEDDB     │
│                              │ │                            │
│ 1. llm.worker.ts (WebLLM)    │ │ Dexie Database:            │
│    Inferencia WebGPU         │ │ • chats & messages         │
│                              │ │ • documents & chunks       │
│ 2. embed.worker.ts (ONNX)    │ │ • embeddings (Float32Array)│
│    Transformers.js miniLM    │ │ • notes                    │
│                              │ │ • app_settings             │
│ 3. python.worker.ts (Pyodide)│ │                            │
│    Python WASM + 15s Guard   │ │ CacheStorage:              │
│                              │ │ • Model weights (quantized)│
│ 4. pdf.worker.mjs (PDF.js)   │ │ • ONNX Runtime WASM        │
│    Extracción local páginas  │ │ • Service Worker Assets    │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 18+ y npm
- Navegador moderno con soporte para **WebGPU** (Chrome 113+, Edge 113+, Android Chrome, Firefox Nightly).
- *(Opcional para Android)* Android Studio Hedgehog+ con Android SDK 34+.

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/tu-usuario/nodo.git
cd nodo/nodo
npm install
```

### 2. Ejecutar en Modo Desarrollo
```bash
npm run dev
```
Abre `http://localhost:3000` en tu navegador.

### 3. Compilar para Producción / PWA
```bash
npm run build
npm run preview
```

### 4. Compilar APK Android
```bash
# Compilar frontend y copiar a assets nativos de Android
npm run build:android

# Compilar APK Debug con Gradle
cd ..
./gradlew.bat assembleDebug
```
El APK resultante se encuentra en `app/build/outputs/apk/debug/app-debug.apk`.

---

## 📱 Despliegue en Android

La aplicación cuenta con una shell Android nativa (`app/`) configurada con:
- WebView con aceleración por hardware WebGPU activada.
- Acceso a archivos locales (`WebChromeClient.onShowFileChooser`) para cargar PDFs y documentos desde el almacenamiento del teléfono.
- Soporte PWA offline mediante Service Worker y caché local.

---

## 🛡️ Seguridad y Privacidad

1. **Aislamiento Total:** Ningún dato, mensaje o documento subido sale del dispositivo. No hay servidores backend, no hay endpoints de analíticas.
2. **Pyodide Sandboxed:** Los scripts de Python se ejecutan dentro de la máquina virtual WebAssembly del navegador sin acceso al sistema de archivos del host.
3. **Calculadora sin Eval:** El evaluador matemático no utiliza `eval()` ni `new Function()`, previniendo inyecciones de código.

---

## 👥 Equipo y Hack47 OFFGRID

- **Proyecto:** NODO (Jinx Engine)
- **Categoría:** Offline First / Sovereign AI / Disaster Tech
- **Hackathon:** Hack47 OFFGRID (Octubre 2026)
- **Licencia:** MIT License
