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
- Pendiente de iniciar

## Ideas pendientes
- QA en emulador/dispositivo (adb no disponible ahora — sin dispositivo conectado)
- Tests instrumentados para diálogos nativos
- Tamaño APK: inspeccionar assets pesados
