package com.example.jinx.llama

import android.content.Context
import android.content.Intent
import android.webkit.JavascriptInterface

/** Puente JS -> nativo para la app web (hasta el rediseño completo). */
class NodoBridge(private val context: Context) {

    @JavascriptInterface
    fun openModels() {
        context.startActivity(Intent(context, ModelsActivity::class.java).apply {
            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    @JavascriptInterface
    fun activeNativeModel(): String {
        val prefs = context.getSharedPreferences("nodo", Context.MODE_PRIVATE)
        return prefs.getString("active_native_model", "") ?: ""
    }
}
