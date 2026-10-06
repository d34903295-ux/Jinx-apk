import { useState } from 'react'

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

export function Markdown({ text, copyCode }: { text: string; copyCode: (code: string) => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const blocks = parseBlocks(text)
  return (
    <div className="flex flex-col gap-2 break-words">
      {blocks.map((b, i) => {
        if (b.type === 'code') {
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                  {b.lang || 'código'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    copyCode(b.text ?? '')
                    setCopiedIdx(i)
                    setTimeout(() => setCopiedIdx((v) => (v === i ? null : v)), 1500)
                  }}
                  className="font-mono text-[10px] text-ink-400 hover:text-white transition cursor-pointer"
                  aria-label="Copiar código" title="Copiar código"
                >
                  {copiedIdx === i ? 'COPIADO' : 'COPIAR'}
                </button>
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-ink-100 scroll-thin">
                {b.text}
              </pre>
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
