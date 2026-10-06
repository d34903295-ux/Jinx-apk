import { useEffect, useState } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import type { Citation, ToolCall } from '../../types'
import { Icon } from './Icon'
import { ToolCallCard } from './ToolCallCard'
import { Markdown } from './Markdown'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  toolCalls?: ToolCall[]
  streaming?: boolean
}

export function MessageBubble({
  role,
  content,
  citations = [],
  toolCalls = [],
  streaming = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const isUser = role === 'user'

  const copyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
    }
  }, [])

  const speak = () => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      if (speaking) {
        synth.cancel()
        setSpeaking(false)
        return
      }
      const utter = new SpeechSynthesisUtterance(content)
      utter.lang = 'es-ES'
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      synth.cancel()
      synth.speak(utter)
      setSpeaking(true)
    } catch {
      /* sin TTS */
    }
  }

  const copy = async () => {
    const ok = await copyText(content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  // Renderizar texto con citas interactivas [1], [2], etc.
  const renderFormattedContent = () => {
    if (isUser || !citations || citations.length === 0) {
      if (!isUser && !streaming) {
        return <Markdown text={content} copyCode={(code) => void copyText(code)} />
      }
      if (!isUser && streaming && !content) {
        return <ThinkingOrb state="working" size={20} aria-label="La IA está escribiendo" />
      }
      return (
        <p className="break-words whitespace-pre-wrap">
          {content}
          {streaming && (
            <span className="ml-1 inline-block h-4 w-[2px] translate-y-0.5 bg-signal-400 shadow-[0_0_8px_#2fa37c] animate-caret" />
          )}
        </p>
      )
    }

    const parts = content.split(/(\[\d+\])/g)

    return (
      <div className="break-words whitespace-pre-wrap">
        {parts.map((part, i) => {
          const match = part.match(/\[(\d+)\]/)
          if (match) {
            const indexNum = parseInt(match[1]!, 10)
            const citation = citations.find((c) => c.index === indexNum)
            if (citation) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveCitation(citation)}
                  className="mx-1 inline-flex items-center justify-center rounded border border-signal-500/40 bg-signal-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-signal-400 transition hover:bg-signal-500/30 hover:shadow-[0_0_8px_rgba(47,163,124,0.3)] hover:scale-105 active:scale-95 cursor-pointer"
                  title={`${citation.docName} (Pág. ${citation.page})`}
                >
                  [{indexNum}]
                </button>
              )
            }
          }
          return <span key={i}>{part}</span>
        })}
        {streaming && (
          <span className="ml-1 inline-block h-4 w-[2px] translate-y-0.5 bg-signal-400 shadow-[0_0_8px_#2fa37c] animate-caret" />
        )}
      </div>
    )
  }

  return (
    <div className={`group flex animate-fade-up ${isUser ? 'justify-end' : 'justify-start'} gap-2.5`}>
      {/* Avatar IA */}
      {!isUser && (
        <div className="size-7 rounded-xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 font-mono text-[10px] font-bold shadow-[0_0_12px_rgba(47,163,124,0.35)] shrink-0 mt-1 select-none">
          AI
        </div>
      )}

      <div className={`flex max-w-[88%] flex-col gap-1 sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={
            isUser
              ? 'rounded-2xl rounded-tr-xs bg-linear-to-br from-signal-400 via-signal-500 to-emerald-600 px-4 py-2.5 text-[14.5px] font-medium leading-relaxed text-ink-950 shadow-lg shadow-signal-500/20 border border-signal-300/40'
              : 'rounded-2xl rounded-tl-xs border border-white/[0.08] bg-[#0e121c]/85 backdrop-blur-xl px-4 py-3 text-[14.5px] leading-relaxed text-ink-100 shadow-xl shadow-black/30'
          }
        >
          {/* Tarjetas de llamadas a herramientas del agente */}
          {!isUser && toolCalls && toolCalls.length > 0 && (
            <div className="mb-2.5 flex flex-col gap-1 border-b border-white/[0.07] pb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal-400 shadow-[0_0_6px_#2fa37c]" />
                HERRAMIENTAS EJECUTADAS:
              </span>
              {toolCalls.map((tc, idx) => (
                <ToolCallCard key={idx} toolCall={tc} />
              ))}
            </div>
          )}

          {renderFormattedContent()}

          {/* Listado de fuentes al pie si hay citas */}
          {!isUser && citations && citations.length > 0 && !streaming && (
            <div className="mt-3 border-t border-white/[0.07] pt-2.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-400 block mb-1.5">
                FUENTES CONSULTADAS (RAG OFFLINE):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {citations.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    onClick={() => setActiveCitation(c)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-ink-300 transition hover:border-signal-500/50 hover:bg-signal-500/10 hover:text-signal-300 cursor-pointer"
                  >
                    <span className="font-mono font-bold text-signal-400">[{c.index}]</span>
                    <span className="max-w-[130px] truncate">{c.docName}</span>
                    <span className="font-mono text-[10px] text-ink-400">p.{c.page}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Botón flotante para copiar mensaje */}
        <div className="flex items-center gap-1 px-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-ink-400 hover:text-ink-200 transition"
            aria-label="Copiar mensaje" title="Copiar mensaje"
          >
            <Icon name={copied ? 'check' : 'copy'} size={12} className={copied ? 'text-signal-400' : ''} />
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          {!isUser && (
            <button
              type="button"
              onClick={speak}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-ink-400 hover:text-ink-200 transition"
              aria-label={speaking ? 'Detener lectura' : 'Leer en voz alta'} title={speaking ? 'Detener lectura' : 'Leer en voz alta'}
            >
              <Icon name={speaking ? 'stop' : 'speak'} size={12} className={speaking ? 'text-signal-400' : ''} />
              <span>{speaking ? 'Leyendo' : 'Escuchar'}</span>
            </button>
          )}
        </div>

        {/* Modal / Diálogo táctico de cita seleccionada */}
        {activeCitation && (
          <div
            role="dialog"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-md cursor-pointer animate-fade-in"
            onClick={() => setActiveCitation(null)}
          >
            <div
              className="glass-card max-w-lg w-full sm:rounded-2xl rounded-t-3xl border border-signal-500/40 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 shadow-2xl flex flex-col gap-3 text-ink-100 cursor-default shadow-[0_0_35px_-5px_rgba(47,163,124,0.2)] animate-sheet-up sm:animate-pop-in"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="size-7 rounded-lg bg-signal-500/20 border border-signal-500/40 text-signal-400 font-mono font-bold text-xs flex items-center justify-center shadow-[0_0_10px_-2px_rgba(47,163,124,0.3)]">
                    {activeCitation.index}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate text-white">
                      {activeCitation.docName}
                    </h4>
                    <span className="font-mono text-[11px] text-signal-400">
                      Página {activeCitation.page} · Índice RAG #{activeCitation.chunkId}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveCitation(null)}
                  className="icon-btn shrink-0"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  FRAGMENTO RECONOCIDO:
                </span>
                <blockquote className="rounded-xl border-l-2 border-signal-400 bg-white/[0.02] p-3 text-xs leading-relaxed text-ink-200 italic max-h-56 overflow-y-auto scroll-thin">
                  "{activeCitation.text}"
                </blockquote>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setActiveCitation(null)}
                  className="btn-primary text-xs py-1.5 px-3.5"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
