import { es, type I18nKey } from './es'

const dict: Record<I18nKey, string> = es

/** Traduce una clave e interpola variables `{nombre}`. */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let text = dict[key]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export type { I18nKey }
