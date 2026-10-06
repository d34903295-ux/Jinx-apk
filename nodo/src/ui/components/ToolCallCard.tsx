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
    <div className="w-full my-2 overflow-hidden rounded-xl border border-white/10 bg-[#0a0d14]/90 backdrop-blur-md shadow-lg shadow-black/30 transition-all">
      {/* Barra superior de terminal */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger-500/80" />
          <span className="size-2 rounded-full bg-ember-400/80" />
          <span className="size-2 rounded-full bg-signal-400/80" />
          <span className="ml-2 font-mono text-[10px] tracking-wider text-ink-400 uppercase">
            TERMINAL // {toolCall.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-signal-400 font-bold uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-signal-400 animate-pulse" />
              RUNNING
            </span>
          ) : toolCall.error ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-danger-400 font-bold uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-danger-400" />
              FAILED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-signal-400 font-bold uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-signal-400 shadow-[0_0_6px_#2fa37c]" />
              DONE 200
            </span>
          )}
        </div>
      </div>

      {/* Cabecera Plegable */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left transition hover:bg-white/[0.03] cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-lg bg-signal-500/10 border border-signal-500/20 text-signal-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_-2px_rgba(47,163,124,0.2)]">
            <Icon name={toolIcon(toolCall.name)} size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-ink-100 truncate">
              {toolNameLabel(toolCall.name)}
            </span>
            <span className="font-mono text-[10px] text-ink-400 truncate">
              call: <span className="text-signal-400">{toolCall.name}</span>(...)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Icon
            name="chevronDown"
            size={14}
            className={`text-ink-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Contenido Desplegable */}
      {expanded && (
        <div className="border-t border-white/[0.06] p-3 flex flex-col gap-2.5 bg-black/40 text-xs animate-fade-up">
          {/* Argumentos */}
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-ink-400 block mb-1">
              INPUT PARAMETERS:
            </span>
            <pre className="font-mono text-[11px] text-ink-200 bg-[#080b11] border border-white/[0.05] p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-32 scroll-thin">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Resultado o Error */}
          {toolCall.error ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-danger-400">
                  STDERR / EXCEPTION:
                </span>
                <button
                  type="button"
                  onClick={copyOutput}
                  className="font-mono text-[10px] text-ink-400 hover:text-white transition"
                >
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <pre className="font-mono text-[11px] text-danger-300 bg-danger-500/10 border border-danger-500/30 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-36 scroll-thin">
                {toolCall.error}
              </pre>
            </div>
          ) : toolCall.result ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-signal-400">
                  STDOUT / OUTPUT:
                </span>
                <button
                  type="button"
                  onClick={copyOutput}
                  className="font-mono text-[10px] text-ink-400 hover:text-white transition"
                >
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <pre className="font-mono text-[11px] text-emerald-200 bg-[#06100c] border border-signal-500/30 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-48 scroll-thin shadow-[inset_0_0_15px_rgba(47,163,124,0.05)]">
                {toolCall.result}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
