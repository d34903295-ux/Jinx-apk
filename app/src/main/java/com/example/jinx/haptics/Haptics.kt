package com.example.jinx.haptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.View

/**
 * Táctil semántico centralizado (patrón Nava: selection/success/warning).
 * Todo vibra a través de aquí para unificar la "sensación" de la app.
 */
object Haptics {
    private fun vibrator(ctx: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= 31) {
            ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private fun buzz(ctx: Context, effect: VibrationEffect) {
        try {
            vibrator(ctx)?.vibrate(effect)
        } catch (_: Exception) {
        }
    }

    /** Micro-click: tabs, toggles, selecciones. */
    fun selection(ctx: Context) {
        buzz(ctx, VibrationEffect.createOneShot(12, 60))
    }

    /** Doble pulso suave: guardado, descarga completa, tarea lista. */
    fun success(ctx: Context) {
        buzz(ctx, VibrationEffect.createWaveform(longArrayOf(0, 25, 60, 35), intArrayOf(0, 120, 0, 160), -1))
    }

    /** Pulso serio: errores y avisos. */
    fun warning(ctx: Context) {
        buzz(ctx, VibrationEffect.createOneShot(60, 180))
    }

    /** Fallback para vistas (WebView): vibración predeterminada del sistema. */
    fun viewTick(view: View) {
        try {
            view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        } catch (_: Exception) {
        }
    }
}
