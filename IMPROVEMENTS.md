# IMPROVEMENTS LOG — Jinx

## Ciclo 1 (2026-10-06) — seguridad + accesibilidad (agentes: security-engineer, accessibility-auditor)
- aria-label duplicando title en botones (TalkBack) — commit a11y
- CSP restrictiva en index.html — commit security
- WebView: sin ventanas múltiples, sin geolocalización, cleartext=false — commit security
- Estado: BUILD OK

## Ciclo 2 — UI/perf (agentes: frontend-developer, mobile-app-builder, code-reviewer)
- build:android limpia www antes de copiar: -25MB de assets viejos, APK 37→35.3MB — commit perf
- Iconos PWA generados (pwa-192/512, marca N esmeralda), eliminado icons.svg huérfano — commit fix
- CSP: permitido cdn.jsdelivr.net tras detectar que Pyodide/pdf.js lo necesitan — commit fix
- aria-label en inputs/textareas — commit a11y
- Estado: BUILD OK

## Ciclo 3 — auditoría lifecycle/batería + bug de concurrencia (agentes: code-reviewer, mobile-app-builder)
- onPause/onResume del WebView en MainActivity — commit perf
- Token de generación: el stream viejo ya no contamina la vista al cambiar de chat (+stop) — commit fix
- Estado: BUILD OK

## Ciclo 4 — robustez de arranque (agentes: code-reviewer, sre)
- Timeout de 20s en el boot de App.tsx — commit stability
- Estado: BUILD OK

## Ciclo 5 — pendiente (rotar a: ux-architect, performance-benchmarker, security-engineer re-auditoría)

## Ciclo 6 — diagnóstico 0% + motor nativo (agentes: mobile-builder, code-reviewer, security-engineer)
- Causa del 0%: WebLLM emite "Start to fetch params" una vez con progreso 0 y
  solo actualiza por shard completo; `cache.add()` por shard es todo-o-nada
  sin reanudar/timeout/velocidad. En móvil = 0% eterno aparente.
- Decisión en docs/ENGINE.md: llama.cpp JNI + GGUF (tamaños HF verificados
  con curl: 807694464 / 986048768 / 1929903264).
- NDK 27 + CMake autod descargados por AGP; `third_party/llama.cpp` (depth 1,
  ignorado en git); solo arm64-v8a en debug.
- Nuevo: `native-lib.cpp` (API C estable), `LlamaBridge`, `LlamaEngine`,
  `ModelDownloader` (Range/resume, MB/s, ETA, verifica tamaño),
  `DownloadService` (foreground + notificación con Pausar/Reanudar/Cancelar),
  `ModelsActivity` (Descargar/Pausar/Reanudar/Eliminar/Usar/Probar),
  `NodoBridge.openModels()` JS, permisos y manifest.
- APK 46.3MB con .so incluida, copiado a Descargas como NODO.apk.
- Estado: BUILD OK
- Pendiente: probar descarga real Llama 3.2 1B + "Probar modelo" en el
  teléfono; rediseño React (drawer + bottom bar + Modelos/Ajustes).

## Ideas pendientes
- QA en emulador/dispositivo (adb no disponible ahora — sin dispositivo conectado)
- Tests instrumentados para diálogos nativos
- Tamaño APK: inspeccionar assets pesados
