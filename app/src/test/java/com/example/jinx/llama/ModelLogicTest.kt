package com.example.jinx.llama

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Lógica pura del motor: progreso y verificación de integridad. */
class ModelLogicTest {

    @Test
    fun fraction_zeroWhenEmpty() {
        val p = DownloadProgress(0, 0, 0.0, -1)
        assertEquals(0f, p.fraction)
    }

    @Test
    fun fraction_half() {
        val p = DownloadProgress(500, 1000, 10.0, 50)
        assertEquals(0.5f, p.fraction, 0.001f)
    }

    @Test
    fun sha256_knownVector() {
        val f = File.createTempFile("nodo-test", ".bin")
        try {
            f.writeBytes("abc".toByteArray())
            // SHA-256("abc") bien conocido.
            assertEquals(
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                ModelDownloader.sha256Of(f),
            )
        } finally {
            f.delete()
        }
    }

    @Test
    fun catalog_sizesPositive() {
        for (m in NATIVE_MODELS) {
            assertTrue("${m.id} sin tamaño", m.expectedBytes > 0)
            assertTrue("${m.id} sin sha", m.sha256.length == 64)
            assertTrue("${m.id} sin URL https", m.url.startsWith("https://"))
        }
    }
}
