package com.example.jinx

import android.annotation.SuppressLint
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.graphics.toColorInt

import com.example.jinx.llama.NodoBridge

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null

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
                onWebViewCreated = { webView = it }
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

    private var micCallback: (() -> Unit)? = null

    private val micPermissionLauncher =
        registerForActivityResult(
            androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
        ) { granted ->
            if (granted) micCallback?.invoke()
            micCallback = null
        }

    /** Pide RECORD_AUDIO y ejecuta el callback al conceder. */
    fun requestMic(onGranted: () -> Unit) {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            onGranted()
            return
        }
        micCallback = onGranted
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
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun NodoWebViewScreen(
    onWebViewCreated: (WebView) -> Unit,
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
                    allowFileAccess = false
                    allowContentAccess = false
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
                    ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

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