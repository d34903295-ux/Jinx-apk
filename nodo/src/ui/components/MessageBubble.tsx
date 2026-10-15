import { useEffect, useState } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import type { Citation, ToolCall, Attachment, GenerationStats } from '../../types'
import { Icon } from './Icon'
import { ToolCallCard } from './ToolCallCard'
import { Markdown } from './Markdown'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  toolCalls?: ToolCall[]
  attachments?: Attachment[]
  streaming?: boolean
  stats?: GenerationStats
  onOpenCode?: (payload: { code: string; lang?: 'javascript' | 'python' | 'html'; autoRun?: boolean }) => void
}

export function MessageBubble({
  role,
  content,
  citations = [],
  toolCalls = [],
  attachments = [],
  streaming = false,
  stats,
  onOpenCode,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null)
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
        return <Markdown text={content} copyCode={(code) => void copyText(code)} onOpenCode={onOpenCode} />
      }
      if (!isUser && streaming && !content) {
        return <ThinkingOrb state="working" size={20} color="#ffffff" aria-label="La IA está escribiendo" />
      }
      return (
        <p className="break-words whitespace-pre-wrap">
          {content}
          {streaming && (
            <span className="ml-1 inline-block h-4 w-[2px] translate-y-0.5 bg-signal-400 shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-caret" />
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
                  className="mx-1 inline-flex items-center justify-center rounded-full border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-black dark:text-white transition hover:bg-black/10 dark:hover:bg-white/20 hover:shadow-[0_0_8px_rgba(255,255,255,0.35)] active:scale-95 cursor-pointer"
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
          <span className="ml-1 inline-block h-4 w-[2px] translate-y-0.5 bg-black dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-caret" />
        )}
      </div>
    )
  }

  return (
    <div className={`group flex animate-fade-up ${isUser ? 'justify-end' : 'justify-start'} gap-2.5`}>
      {/* Avatar IA */}
      {!isUser && (
        <div className="size-7 rounded-full bg-black text-white dark:bg-white dark:text-black font-mono text-[10px] font-bold shadow-[0_0_14px_rgba(255,255,255,0.35)] shrink-0 mt-1 select-none flex items-center justify-center border border-white/20">
          AI
        </div>
      )}

      <div className={`flex max-w-[88%] flex-col gap-1 sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={
            isUser
              ? 'rounded-2xl rounded-tr-xs bg-black text-white dark:bg-white dark:text-black px-4 py-2.5 text-[14.5px] font-medium leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_rgba(255,255,255,0.15)] border border-black/10 dark:border-white/30'
              : 'rounded-2xl rounded-tl-xs border border-black/10 dark:border-white/12 bg-white/70 dark:bg-black/65 backdrop-blur-2xl px-4 py-3 text-[14.5px] leading-relaxed text-ink-950 dark:text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_32px_rgba(0,0,0,0.4)]'
          }
        >
          {/* Tarjetas de llamadas a herramientas del agente */}
          {!isUser && toolCalls && toolCalls.length > 0 && (
            <div className="mb-2.5 flex flex-col gap-1 border-b border-white/[0.07] pb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-white/50 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-black dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                HERRAMIENTAS EJECUTADAS:
              </span>
              {toolCalls.map((tc, idx) => (
                <ToolCallCard key={idx} toolCall={tc} />
              ))}
            </div>
          )}

          {/* Archivos e imágenes adjuntas */}
          {attachments && attachments.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {attachments.map((att) => {
                if (att.type === 'image' && att.dataUrl) {
                  return (
                    <div
                      key={att.id}
                      onClick={() => setPreviewImage(att)}
                      className={`group/img relative max-w-[260px] sm:max-w-[300px] rounded-2xl overflow-hidden border cursor-pointer transition hover:shadow-xl active:scale-[0.98] ${
                        isUser
                          ? 'border-white/20 dark:border-black/20 bg-black/40 dark:bg-black/5'
                          : 'border-black/10 dark:border-white/20 bg-black/5 dark:bg-black/40'
                      }`}
                    >
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="w-full h-auto max-h-56 object-cover rounded-t-2xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end p-2 justify-between">
                        <span className="text-[10px] font-mono text-white truncate max-w-[150px]">{att.name}</span>
                        <span className="text-[10px] font-mono text-white/90 bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-md">
                          <Icon name="eye" size={12} /> Ver
                        </span>
                      </div>
                      {att.visionAnalysis && (
                        <div
                          className={`p-1.5 border-t flex items-center justify-between text-[10px] font-mono ${
                            isUser
                              ? 'bg-black/80 text-white dark:bg-neutral-100 dark:text-neutral-900 border-black/10'
                              : 'bg-black/70 text-white dark:bg-neutral-900/90 dark:text-neutral-100 border-white/10'
                          }`}
                        >
                          <span className="truncate">{att.visionAnalysis.category}</span>
                          <span className="font-semibold">{att.visionAnalysis.width}×{att.visionAnalysis.height}</span>
                        </div>
                      )}
                    </div>
                  )
                }
                const ext = att.name.split('.').pop()?.toUpperCase() || 'FILE'
                return (
                  <div
                    key={att.id}
                    className={`inline-flex items-center gap-2.5 rounded-2xl border p-2.5 pr-4 text-xs backdrop-blur-md max-w-full transition shadow-xs ${
                      isUser
                        ? 'border-white/20 bg-white/10 text-white dark:border-black/15 dark:bg-black/5 dark:text-black'
                        : 'border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.06] text-black dark:text-white'
                    }`}
                  >
                    <div
                      className={`size-9 rounded-xl border flex items-center justify-center shrink-0 font-mono font-bold text-[10px] shadow-xs ${
                        isUser
                          ? 'bg-white/20 border-white/30 text-white dark:bg-black/10 dark:border-black/20 dark:text-black'
                          : 'bg-black/10 border-black/15 text-black dark:bg-white/15 dark:border-white/20 dark:text-white'
                      }`}
                    >
                      {ext.length <= 4 ? ext : <Icon name="fileText" size={16} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs truncate max-w-[200px]">{att.name}</span>
                      <span className="font-mono text-[10px] opacity-75">
                        {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Documento'}
                        {att.textContent ? ' • Analizado' : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1 text-xs text-ink-700 dark:text-white/80 transition hover:border-black/30 dark:hover:border-white/30 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 cursor-pointer"
                  >
                    <span className="font-mono font-bold text-black dark:text-white">[{c.index}]</span>
                    <span className="max-w-[130px] truncate">{c.docName}</span>
                    <span className="font-mono text-[10px] text-ink-400 dark:text-white/40">p.{c.page}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Telemetría de inferencia: tokens/s, TTFT, backend */}
        {!isUser && stats && (
          <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-ink-400 dark:text-white/45 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
              ⚡ {stats.tokensPerSecond.toFixed(1)} tok/s
            </span>
            <span>TTFT: {(stats.ttftMs / 1000).toFixed(2)}s</span>
            <span>·</span>
            <span>{stats.generatedTokens} tok</span>
            <span>·</span>
            <span className="uppercase text-[10px] px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-bold">{stats.backend}</span>
          </div>
        )}

        {/* Acciones del mensaje: copiar y escuchar */}
        <div className="flex items-center gap-1 px-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 min-h-[36px] text-xs font-medium text-ink-400 hover:text-ink-100 hover:bg-white/[0.05] transition active:scale-95 cursor-pointer"
            aria-label="Copiar mensaje"
            title="Copiar mensaje"
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} className={copied ? 'text-signal-400' : ''} />
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          {!isUser && (
            <button
              type="button"
              onClick={speak}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 min-h-[36px] text-xs font-medium text-ink-400 hover:text-ink-100 hover:bg-white/[0.05] transition active:scale-95 cursor-pointer"
              aria-label={speaking ? 'Detener lectura' : 'Leer en voz alta'}
              title={speaking ? 'Detener lectura' : 'Leer en voz alta'}
            >
              <Icon name={speaking ? 'stop' : 'speak'} size={14} className={speaking ? 'text-signal-400' : ''} />
              <span>{speaking ? 'Detener' : 'Escuchar'}</span>
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
              className="glass-card max-w-lg w-full sm:rounded-2xl rounded-t-3xl border border-white/20 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5 shadow-2xl flex flex-col gap-3 text-ink-100 cursor-default shadow-[0_0_35px_-5px_rgba(255,255,255,0.15)] animate-sheet-up sm:animate-pop-in"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="size-7 rounded-lg bg-white/10 border border-white/20 text-white font-mono font-bold text-xs flex items-center justify-center shadow-[0_0_10px_-2px_rgba(255,255,255,0.2)]">
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

        {/* Lightbox / Modal de inspección de imagen */}
        {previewImage && previewImage.dataUrl && (
          <div
            role="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg cursor-pointer animate-fade-in"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center gap-3 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-between text-white px-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm truncate">{previewImage.name}</span>
                  {previewImage.visionAnalysis && (
                    <span className="font-mono text-[11px] text-ink-400">
                      {previewImage.visionAnalysis.summary}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="icon-btn text-white bg-white/10 hover:bg-white/20 rounded-full"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="rounded-2xl border border-white/20 overflow-hidden bg-black/60 shadow-2xl max-h-[75vh] flex items-center justify-center">
                <img
                  src={previewImage.dataUrl}
                  alt={previewImage.name}
                  className="max-h-[72vh] max-w-full object-contain"
                />
              </div>

              {previewImage.visionAnalysis && (
                <div className="w-full glass-card p-3 rounded-xl border border-white/15 text-xs text-ink-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-ink-400 uppercase">Paleta:</span>
                    <div className="flex items-center gap-1">
                      {previewImage.visionAnalysis.dominantColors.map((c, i) => (
                        <span
                          key={i}
                          className="size-4 rounded-full border border-white/30"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-white">
                    {previewImage.visionAnalysis.width}×{previewImage.visionAnalysis.height} ({previewImage.visionAnalysis.aspectRatio})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
