package com.example.jinx

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.graphics.toColorInt
import androidx.webkit.WebViewAssetLoader

import com.example.jinx.llama.NodoBridge

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris: Array<Uri>? = if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            when {
                data?.clipData != null -> {
                    val clip = data.clipData!!
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                }
                data?.data != null -> {
                    arrayOf(data.data!!)
                }
                else -> null
            }
        } else {
            null
        }
        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

    private var pendingImportModelId: String? = null

    private val importModelLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uri = result.data?.data
        val targetId = pendingImportModelId
        pendingImportModelId = null
        if (result.resultCode == Activity.RESULT_OK && uri != null && targetId != null) {
            com.example.jinx.llama.ModelImporter.startImport(this, targetId, uri) { success, err ->
                runOnUiThread {
                    webView?.post {
                        val js = if (success) {
                            "window.__nodoOnImportComplete?.('${targetId}', true, null)"
                        } else {
                            val msg = err ?: "Error al importar el archivo"
                            "window.__nodoOnImportComplete?.('${targetId}', false, ${org.json.JSONObject.quote(msg)})"
                        }
                        webView?.evaluateJavascript(js, null)
                    }
                }
            }
        } else {
            com.example.jinx.llama.ModelImporter.cancelImport()
            runOnUiThread {
                webView?.post {
                    webView?.evaluateJavascript(
                        "window.__nodoOnImportComplete?.('${targetId ?: ""}', false, 'Importación cancelada')",
                        null
                    )
                }
            }
        }
    }

    fun openModelFilePicker(modelId: String) {
        pendingImportModelId = modelId
        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
            }
            importModelLauncher.launch(intent)
        } catch (e: Exception) {
            Log.e("NODO", "Error abriendo selector de archivos SAF", e)
            com.example.jinx.llama.ModelImporter.cancelImport()
        }
    }

    fun handleOpenFileChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams?
    ): Boolean {
        // Cancelar callback previo si quedó pendiente para no bloquear el WebView
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = callback

        try {
            val isMultiple = params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, isMultiple)
                type = "*/*"

                val rawTypes = params?.acceptTypes?.filter { it.isNotBlank() }
                if (!rawTypes.isNullOrEmpty()) {
                    val hasWildcard = rawTypes.any { it.contains("*/*") || it == "*" }
                    if (!hasWildcard) {
                        val mimeList = rawTypes.flatMap { raw ->
                            raw.split(",").map { it.trim().lowercase() }
                        }.mapNotNull { token ->
                            when {
                                token.isEmpty() || token == "*/*" -> null
                                token == ".pdf" || token == "pdf" -> "application/pdf"
                                token == ".docx" || token == "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                token == ".doc" || token == "doc" -> "application/msword"
                                token == ".txt" || token == "txt" -> "text/plain"
                                token == ".csv" || token == "csv" -> "text/comma-separated-values"
                                token == ".json" || token == "json" -> "application/json"
                                token.startsWith(".") -> null
                                else -> token
                            }
                        }.distinct()

                        if (mimeList.isNotEmpty()) {
                            putExtra(Intent.EXTRA_MIME_TYPES, mimeList.toTypedArray())
                        }
                    }
                }
            }

            val chooser = Intent.createChooser(intent, "Seleccionar archivo o documento")
            fileChooserLauncher.launch(chooser)
            return true
        } catch (e: Exception) {
            Log.e("NODO", "Error al abrir selector de archivos nativo", e)
            fileChooserCallback?.onReceiveValue(null)
            fileChooserCallback = null
            return false
        }
    }

    companion object {
        /** Texto compartido desde otras apps, pendiente de recoger por la UI. */
        @Volatile
        var pendingSharedText: String? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationPermission()
        handleShareIntent(intent)

        // Manejo del botón atrás en el historial de navegación web
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView?.canGoBack() == true) {
                    webView?.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        setContent {
            NodoWebViewScreen(
                onWebViewCreated = { webView = it },
                onOpenFileChooser = { callback, params -> handleOpenFileChooser(callback, params) }
            )
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShareIntent(intent)
        // Avisar a la UI si ya está cargada.
        webView?.post {
            webView?.evaluateJavascript(
                "window.dispatchEvent(new Event('nodo-shared-text'))",
                null,
            )
        }
    }

    private fun handleShareIntent(intent: android.content.Intent?) {
        if (intent?.action == android.content.Intent.ACTION_SEND && intent.type == "text/plain") {
            intent.getStringExtra(android.content.Intent.EXTRA_TEXT)?.takeIf { it.isNotBlank() }?.let {
                pendingSharedText = it
            }
        }
    }

    private var micGrantedCallback: (() -> Unit)? = null
    private var micDeniedCallback: (() -> Unit)? = null

    private val micPermissionLauncher =
        registerForActivityResult(
            androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
        ) { granted ->
            if (granted) {
                micGrantedCallback?.invoke()
            } else {
                micDeniedCallback?.invoke()
            }
            micGrantedCallback = null
            micDeniedCallback = null
        }

    /** Pide RECORD_AUDIO y ejecuta el callback correspondiente. */
    fun requestMic(onGranted: () -> Unit, onDenied: () -> Unit = {}) {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            onGranted()
            return
        }
        micGrantedCallback = onGranted
        micDeniedCallback = onDenied
        micPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 41)
        }
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun NodoWebViewScreen(
    onWebViewCreated: (WebView) -> Unit,
    onOpenFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams?) -> Boolean,
    modifier: Modifier = Modifier
) {
    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { context ->
            val assetsHandler = WebViewAssetLoader.AssetsPathHandler(context)
            val assetLoader = WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/") { path ->
                    assetsHandler.handle("www/" + path.ifEmpty { "index.html" })
                }
                .build()

            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )

                setBackgroundColor("#090D14".toColorInt())

                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                    mediaPlaybackRequiresUserGesture = false
                    cacheMode = WebSettings.LOAD_DEFAULT
                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    javaScriptCanOpenWindowsAutomatically = false
                    setSupportMultipleWindows(false)
                    setGeolocationEnabled(false)
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    setSupportZoom(false)
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        val resp = assetLoader.shouldInterceptRequest(request.url) ?: return null
                        val headers = resp.responseHeaders?.toMutableMap() ?: mutableMapOf()
                        headers["Access-Control-Allow-Origin"] = "*"
                        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                        headers["Access-Control-Allow-Headers"] = "*"
                        resp.responseHeaders = headers
                        return resp
                    }

                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?
                    ): Boolean {
                        val url = request?.url ?: return false
                        val host = url.host.orEmpty()
                        if (host == "appassets.androidplatform.net") {
                            return false
                        }
                        return try {
                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, url).apply {
                                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            view?.context?.startActivity(intent)
                            true
                        } catch (e: Exception) {
                            Log.e("NODO", "Error al abrir enlace externo: $url", e)
                            true
                        }
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        Log.d("NODO", "Página cargada exitosamente: $url")
                    }

                    override fun onRenderProcessGone(
                        view: WebView?,
                        detail: android.webkit.RenderProcessGoneDetail?
                    ): Boolean {
                        Log.e("NODO", "Proceso de render perdido (crash), reiniciando WebView")
                        view?.destroy()
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            (view?.context as? MainActivity)?.recreate()
                        }, 300)
                        return true
                    }
                }

                webChromeClient = object : WebChromeClient() {
                    override fun onShowFileChooser(
                        webView: WebView?,
                        filePathCallback: ValueCallback<Array<Uri>>?,
                        fileChooserParams: FileChooserParams?
                    ): Boolean {
                        if (filePathCallback == null) return false
                        return onOpenFileChooser(filePathCallback, fileChooserParams)
                    }

                    override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                        Log.d(
                            "NODO_JS",
                            "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}"
                        )
                        return true
                    }

                    override fun onJsAlert(
                        view: WebView?, url: String?, message: String?,
                        result: android.webkit.JsResult?
                    ): Boolean {
                        androidx.appcompat.app.AlertDialog.Builder(view?.context ?: return false)
                            .setMessage(message)
                            .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                            .setOnCancelListener { result?.cancel() }
                            .show()
                        return true
                    }

                    override fun onJsConfirm(
                        view: WebView?, url: String?, message: String?,
                        result: android.webkit.JsResult?
                    ): Boolean {
                        androidx.appcompat.app.AlertDialog.Builder(view?.context ?: return false)
                            .setMessage(message)
                            .setPositiveButton(android.R.string.ok) { _, _ -> result?.confirm() }
                            .setNegativeButton(android.R.string.cancel) { _, _ -> result?.cancel() }
                            .setOnCancelListener { result?.cancel() }
                            .show()
                        return true
                    }
                }

                addJavascriptInterface(
                    NodoBridge(context) { js ->
                        post { evaluateJavascript(js, null) }
                    },
                    "NodoNative",
                )

                loadUrl("https://appassets.androidplatform.net/index.html")
                onWebViewCreated(this)
            }
        },
        update = {}
    )
}