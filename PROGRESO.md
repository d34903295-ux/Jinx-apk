# PROGRESO — Jinx

## 2026-10-06
- git init + baseline commit
- Rebuild www con mejoras UI previas (safe areas, transiciones, modales bottom-sheet)
- MainActivity: loadUrl ahora apunta a assets locales (no a cloudflare tunnel)
- Creación de BACKLOG.md y este archivo

## Hecho (iteración autónoma)
1. Tema nativo oscuro (themes.xml) ✔
2. configChanges evita recrear WebView ✔
3. MIXED_CONTENT_NEVER_ALLOW ✔
4. largeHeap=true ✔
5. textarea legible en tema claro ✔
6. wake lock durante generación ✔
7. confirm/alert funcionales en WebView (bug real: confirm() siempre false → borrados rotos; añadido diálogo nativo + confirm en borrar chat) ✔
8. onRenderProcessGone recupera crash del renderer ✔
9. installer.ts: manejo de errores amigable + try/catch offline status ✔

## Siguiente
- Revisar performance de blur/backdrop en WebView de Android (bajar blur en móvil)
- Accesibilidad: labels aria en botones de iconos
- Indexar búsqueda en Library de forma diferida
- Revisar appCached/dev fallback
- Tamaño APK: inspeccionar assets no usados
