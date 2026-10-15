# Jinx — 100% Offline AI Agent (Hack47 OFFGRID)

> Repositorio oficial del proyecto **Jinx** para el Hackathon **Hack47 OFFGRID**.

## Estructura del Proyecto

- `nodo/`: Núcleo de la aplicación web y motor de IA (React 19, TypeScript, Vite, Tailwind CSS, WebLLM WebGPU, Transformers.js ONNX, Pyodide WASM, Dexie IndexedDB).
- `app/`: Shell nativa de Android (Kotlin, Jetpack, WebView con WebGPU, almacenamiento offline, puente C++ con llama.cpp).
- `landing-page/`: Landing page promocional de Jinx.
- `public/packs/emergencia/`: Pack de supervivencia médica y primeros auxilios offline.

## Documentación Completa
- [Documentación Técnica y README de Jinx](nodo/README.md)
- [Arquitectura del Sistema](nodo/docs/ARCHITECTURE.md)
- [Guion de Demostración Hack47](nodo/docs/DEMO.md)

## APK Android Compilado
El APK debug listo para instalar se encuentra en:
- `app/build/outputs/apk/debug/app-debug.apk`
- `C:\Users\Administrator\Downloads\Jinx-app.apk`
