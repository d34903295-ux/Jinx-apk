# ENGINE.md — Decisión de motor de IA local

## Diagnóstico del 0% "Start to fetch params" (WebLLM 0.2.85)

Lectura directa de `nodo/node_modules/@mlc-ai/web-llm/lib/index.js`:

1. El texto se emite **una sola vez con progreso 0** (`fetchTensorCacheInternal`, línea ~7552).
   Después, el progreso solo se actualiza **por shard completo descargado**.
   El primer shard (decenas/MB cientos de MB) se descarga sin ningún feedback →
   la UI parece congelada en 0% aunque esté descargando.
2. La descarga usa `cache.add(request)` por shard: **todo o nada, sin reanudar,
   sin timeout, sin velocidad**. Cualquier microcorte de red reinicia el shard
   en silencio → bucle infinito de 0% en redes inestables.
3. El shard entero se materializa como ArrayBuffer en el renderer del WebView →
   presión de memoria que en teléfonos puede matar el proceso a mitad de fetch.
4. Los errores sí saldrían en pantalla (SetupWizard los muestra), así que si se
   ve "0% atascado" y no un error, el fetch está colgado/lentísimo, no fallando.

Conclusión: el síntoma es estructural del diseño de descarga de WebLLM, no un
bug de nuestra UI. Parchearlo exigiría reescribir su capa de descarga.

## Decisión

**llama.cpp vía JNI + modelos GGUF de Hugging Face.**

Justificación en una línea: control total de la descarga (pausar/reanudar,
MB/s, ETA, hash SHA-256), inferencia CPU ARM64 sin depender de WebGPU, y
cuantizados Q4 de 1–3B que corren en 8 GB de RAM.

## Modelos (GGUF, HTTPS, hash verificado)

| Modelo | Archivo | Tamaño aprox | RAM |
|---|---|---|---|
| Llama 3.2 1B Q4_K_M | `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (bartowski) | ~800 MB | ~2 GB |
| Qwen 2.5 1.5B Q4_K_M | `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` (bartowski) | ~1 GB | ~2.5 GB |
| Qwen 2.5 3B Q4_K_M | `Qwen2.5-3B-Instruct-Q4_K_M.gguf` (bartowski) | ~1.9 GB | ~3.5 GB |
| Qwen 2.5 7B Q4_K_M | solo aviso: ~4.9 GB, no cabe bien en 8 GB | — | ~7 GB |

## Arquitectura nativa

- `third_party/llama.cpp` (clone `--depth 1`, ignorado en git) + `app/src/main/cpp/`
  con `CMakeLists.txt` y `native-lib.cpp` (puente JNI: init, generate con
  callback de tokens, stop).
- Solo ABI `arm64-v8a` en debug para compilar rápido; release añade el resto.
- `ModelDownloader` (OkHttp, `Range`, reanudar, progreso MB/s + ETA, SHA-256)
  corriendo en `DownloadService` (foreground + notificación).
- `LlamaEngine` (Kotlin): carga el `.gguf` en hilo de fondo, streaming de
  tokens, `stop()`.
- `ModelsActivity` (Compose): lista, estados, Descargar/Pausar/Reanudar/
  Eliminar/Usar/Probar. Puente JS `NodoNative.openModels()` para abrirla
  desde la app web hasta el rediseño completo de navegación.
