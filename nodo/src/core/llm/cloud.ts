import { getSetting } from '../db/repo'

export interface CloudResponse {
  ok: boolean
  text: string
  error?: string
}

/**
 * Realiza una consulta opcional a la nube (Gemini o Claude) cuando el usuario pulsa
 * el botón "Respuesta avanzada (nube)". Local por defecto siempre.
 */
export async function queryCloudApi(
  prompt: string,
  systemPrompt = 'Responde en español, directo y preciso.',
): Promise<CloudResponse> {
  const apiKey = (await getSetting<string>('cloudApiKey'))?.trim()
  const provider = (await getSetting<string>('cloudProvider')) || 'gemini'

  if (!apiKey) {
    return {
      ok: false,
      text: '',
      error: 'Sin clave de API en la nube. Configura tu API Key de Gemini o Claude en Ajustes.',
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      text: '',
      error: 'Sin conexión a Internet disponible para la consulta en la nube.',
    }
  }

  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1024,
          },
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, text: '', error: `Error Gemini (${res.status}): ${errText.slice(0, 150)}` }
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      return { ok: true, text }
    } else {
      // Claude Anthropic API
      const url = 'https://api.anthropic.com/v1/messages'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        return { ok: false, text: '', error: `Error Claude (${res.status}): ${errText.slice(0, 150)}` }
      }

      const data = await res.json()
      const text = data?.content?.[0]?.text || ''
      return { ok: true, text }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error de conexión con la API en la nube'
    return { ok: false, text: '', error: msg }
  }
}
