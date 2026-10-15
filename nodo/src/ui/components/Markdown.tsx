import { useState } from 'react'
import { Icon } from './Icon'
import { detectLanguage } from '../../core/code/codePipeline'

/**
 * Markdown mínimo sin dependencias (negrita, cursiva, código, listas,
 * encabezados). Suficiente para respuestas de un LLM local.
 */

interface Block {
  type: 'code' | 'header' | 'list' | 'ordered' | 'para'
  lang?: string
  level?: number
  items?: string[]
  text?: string
}

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const fence = line.match(/^```(\w*)/)
    if (fence) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        buf.push(lines[i]!)
        i++
      }
      i++
      blocks.push({ type: 'code', lang: fence[1] || '', text: buf.join('\n') })
      continue
    }
    const header = line.match(/^(#{1,3})\s+(.*)/)
    if (header) {
      blocks.push({ type: 'header', level: header[1]!.length, text: header[2] })
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ordered', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i]!) &&
      !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]!)
    ) {
      buf.push(lines[i]!)
      i++
    }
    blocks.push({ type: 'para', text: buf.join('\n') })
  }
  return blocks
}

function Inline({ text }: { text: string }) {
  // Divide por `código`, **negrita** y *cursiva* manteniendo el orden.
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-black/30 px-1 py-0.5 font-mono text-[12.5px] text-signal-300"
            >
              {p.slice(1, -1)}
            </code>
          )
        }
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              {p.slice(2, -2)}
            </strong>
          )
        }
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
          return <em key={i}>{p.slice(1, -1)}</em>
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

export function Markdown({
  text,
  copyCode,
  onOpenCode,
}: {
  text: string
  copyCode: (code: string) => void
  onOpenCode?: (payload: { code: string; lang?: 'javascript' | 'python' | 'html'; autoRun?: boolean }) => void
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const blocks = parseBlocks(text)
  return (
    <div className="flex flex-col gap-2 break-words">
      {blocks.map((b, i) => {
        if (b.type === 'code') {
          const rawCode = b.text ?? ''
          const detectedLang = detectLanguage(rawCode, b.lang)
          const lineCount = rawCode.split('\n').length
          const isLargeCode = lineCount >= 3 || detectedLang === 'html'

          return (
            <div key={i} className="my-1.5 overflow-hidden rounded-2xl border border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.05] p-3 backdrop-blur-md shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                    <Icon name="code" size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                        {detectedLang === 'html' ? 'Aplicación Web / UI' : detectedLang === 'python' ? 'Script Python' : 'Script JavaScript'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 uppercase">
                        {detectedLang === 'html' ? 'UI' : detectedLang.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                      {lineCount} líneas • {detectedLang === 'html' ? 'Renderizable en vivo' : 'Listo para ejecutar'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      copyCode(rawCode)
                      setCopiedIdx(i)
                      setTimeout(() => setCopiedIdx((v) => (v === i ? null : v)), 1500)
                    }}
                    className="px-2.5 py-1.5 rounded-full border border-black/10 dark:border-white/15 text-[11px] font-mono text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition cursor-pointer"
                    title="Copiar código fuente"
                  >
                    {copiedIdx === i ? 'COPIADO' : 'COPIAR'}
                  </button>

                  {onOpenCode && (
                    <button
                      type="button"
                      onClick={() => onOpenCode({ code: rawCode, lang: detectedLang, autoRun: detectedLang === 'html' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs text-white bg-black dark:bg-white dark:text-black hover:opacity-90 active:scale-95 transition shadow-sm cursor-pointer"
                      title="Abrir en Code Studio Pro y ejecutar"
                    >
                      <Icon name="play" size={12} />
                      <span>Abrir en Código</span>
                    </button>
                  )}
                </div>
              </div>

              {!isLargeCode && (
                <pre className="mt-2.5 overflow-x-auto p-2.5 rounded-xl bg-black/40 font-mono text-[11.5px] leading-relaxed text-neutral-200 border border-white/5 scroll-thin">
                  {rawCode}
                </pre>
              )}
            </div>
          )
        }
        if (b.type === 'header') {
          const cls =
            b.level === 1
              ? 'text-base font-bold text-white'
              : b.level === 2
                ? 'text-[15px] font-bold text-white'
                : 'text-sm font-semibold text-ink-100'
          return (
            <div key={i} className={cls}>
              <Inline text={b.text ?? ''} />
            </div>
          )
        }
        if (b.type === 'list') {
          return (
            <ul key={i} className="flex flex-col gap-1 pl-1">
              {(b.items ?? []).map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-signal-400" />
                  <span>
                    <Inline text={it} />
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ordered') {
          return (
            <ol key={i} className="flex flex-col gap-1 pl-1">
              {(b.items ?? []).map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="font-mono text-xs text-signal-400 shrink-0">{j + 1}.</span>
                  <span>
                    <Inline text={it} />
                  </span>
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={b.text ?? ''} />
          </p>
        )
      })}
    </div>
  )
}
