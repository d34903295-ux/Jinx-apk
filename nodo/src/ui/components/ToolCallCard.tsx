import { useState } from 'react'
import type { ToolCall } from '../../types'
import { Icon } from './Icon'

interface ToolCallCardProps {
  toolCall: ToolCall
  isLive?: boolean
}

export function ToolCallCard({ toolCall, isLive = false }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const toolNameLabel = (name: string) => {
    switch (name) {
      case 'run_python':
        return 'Python Sandbox (Pyodide)'
      case 'calculator':
        return 'Math Engine'
      case 'search_docs':
        return 'RAG Vector Search'
      case 'summarize_doc':
        return 'Doc Summarizer'
      case 'notes':
        return 'Notes Engine'
      case 'emergency':
        return 'Survival Protocols'
      default:
        return name
    }
  }

  const toolIcon = (name: string) => {
    switch (name) {
      case 'run_python':
        return 'cpu' as const
      case 'calculator':
        return 'sparkles' as const
      case 'search_docs':
        return 'search' as const
      case 'summarize_doc':
        return 'fileText' as const
      case 'notes':
        return 'copy' as const
      case 'emergency':
        return 'shield' as const
      default:
        return 'sparkles' as const
    }
  }

  const copyOutput = async () => {
    const text = toolCall.error || toolCall.result || ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full my-2 overflow-hidden rounded-2xl border border-white/12 bg-black/75 backdrop-blur-xl shadow-xl transition-all">
      {/* Barra superior de terminal */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white/30" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/10" />
          <span className="ml-2 font-mono text-[10px] tracking-wider text-ink-400 dark:text-white/50 uppercase">
            TERMINAL // {toolCall.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] text-white/90 font-bold uppercase tracking-wider bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
              <span className="size-1.5 rounded-full bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              EN CURSO
            </span>
          ) : toolCall.error ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] text-danger-400 font-bold uppercase tracking-wider bg-danger-500/10 border border-danger-500/30 px-2 py-0.5 rounded-full">
              <span className="size-1.5 rounded-full bg-danger-400" />
              ERROR
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] text-white font-bold uppercase tracking-wider bg-white/10 border border-white/20 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              <span className="size-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
              ÉXITO
            </span>
          )}
        </div>
      </div>

      {/* Cabecera Plegable */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between p-3.5 min-h-[48px] text-left transition hover:bg-white/[0.03] cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-7 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            <Icon name={toolIcon(toolCall.name)} size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate">
              {toolNameLabel(toolCall.name)}
            </span>
            <span className="font-mono text-[10px] text-ink-400 dark:text-white/45 truncate">
              call: <span className="text-white font-semibold">{toolCall.name}</span>(...)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Icon
            name="chevronDown"
            size={14}
            className={`text-ink-400 dark:text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Contenido Desplegable */}
      {expanded && (
        <div className="border-t border-white/[0.08] p-3.5 flex flex-col gap-3 bg-black/60 text-xs animate-fade-up">
          {/* Argumentos */}
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-ink-400 dark:text-white/40 block mb-1">
              PARÁMETROS DE ENTRADA:
            </span>
            <pre className="font-mono text-[11px] text-ink-200 bg-black/80 border border-white/10 p-2.5 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-32 scroll-thin">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Resultado o Error */}
          {toolCall.error ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-danger-400">
                  ERROR / EXCEPCIÓN:
                </span>
                <button
                  type="button"
                  onClick={copyOutput}
                  aria-label="Copiar error"
                  className="font-mono text-[10px] text-ink-400 hover:text-white transition px-2.5 py-1 rounded-full border border-white/10 hover:border-white/25 cursor-pointer"
                >
                  {copied ? 'COPIADO' : 'COPIAR'}
                </button>
              </div>
              <pre className="font-mono text-[11px] text-danger-300 bg-danger-500/10 border border-danger-500/30 p-2.5 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-36 scroll-thin">
                {toolCall.error}
              </pre>
            </div>
          ) : toolCall.result ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-white">
                  SALIDA / RESULTADO:
                </span>
                <button
                  type="button"
                  onClick={copyOutput}
                  aria-label="Copiar resultado"
                  className="font-mono text-[10px] text-ink-400 hover:text-white transition px-2.5 py-1 rounded-full border border-white/10 hover:border-white/25 cursor-pointer"
                >
                  {copied ? 'COPIADO' : 'COPIAR'}
                </button>
              </div>
              <pre className="font-mono text-[11px] text-white/90 bg-black/80 border border-white/15 p-2.5 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-48 scroll-thin shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]">
                {toolCall.result}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
