import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import type { ChatRecord, MessageRecord, Citation, ToolCall } from '../../types'
import {
  listChats,
  createChat,
  deleteChat,
  getMessages,
  addMessage,
  titleFrom,
} from '../../core/db/repo'
import { llm } from '../../core/llm/llmClient'
import { buildChatMessages, buildRagMessages, type HistoryMessage } from '../../core/agent/prompts'
import { searchChunks } from '../../core/rag/search'
import { runAgentLoop } from '../../core/agent/loop'
import { labelForModelId } from '../../core/llm/models'
import { useLLM, useOnline, useOfflineStatus, useWakeLockWhileGenerating } from '../hooks/useNodo'
import { Icon, Logo } from './Icon'
import { MessageBubble } from './MessageBubble'
import { OfflineBadge } from './OfflineBadge'
import { ProgressBar } from './ProgressBar'

interface ChatViewProps {
  activeModelId: string | null
  onChangeModel: () => void
  onOpenLibrary: () => void
  onOpenNotes: () => void
  onOpenSettings?: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  initialPrompt?: string | null
  onClearInitialPrompt?: () => void
}

export function ChatView({
  activeModelId,
  onChangeModel,
  onOpenLibrary,
  onOpenNotes,
  onOpenSettings,
  theme,
  onToggleTheme,
  initialPrompt,
  onClearInitialPrompt,
}: ChatViewProps) {
  const llmState = useLLM()
  const online = useOnline()
  const offlineStatus = useOfflineStatus(activeModelId)
  useWakeLockWhileGenerating()

  const [chats, setChats] = useState<ChatRecord[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [input, setInput] = useState('')
  const [agentMode, setAgentMode] = useState(true)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([])
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCall[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Cargar lista de chats
  const refreshChats = async (selectLatest = false) => {
    const list = await listChats()
    setChats(list)
    if (selectLatest && list.length > 0 && list[0]) {
      setActiveChatId(list[0].id)
    } else if (list.length === 0) {
      setActiveChatId(null)
      setMessages([])
    }
  }

  useEffect(() => {
    void refreshChats(true)
  }, [])

  // Cargar mensajes cuando cambia el chat activo
  useEffect(() => {
    let alive = true
    if (activeChatId !== null) {
      getMessages(activeChatId).then((msgs) => {
        if (alive) setMessages(msgs)
      })
    } else {
      setMessages([])
    }
    return () => {
      alive = false
    }
  }, [activeChatId])

  // Auto-scroll al final en nuevos mensajes o streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-resize del textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }

  const handleNewChat = () => {
    setActiveChatId(null)
    setMessages([])
    setInput('')
    setStreamingContent(null)
    setSidebarOpen(false)
  }

  const handleDeleteChat = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('chat.confirmDelete'))) return
    await deleteChat(id)
    if (activeChatId === id) {
      const remaining = chats.filter((c) => c.id !== id)
      if (remaining.length > 0 && remaining[0]) {
        setActiveChatId(remaining[0].id)
      } else {
        handleNewChat()
      }
    }
    await refreshChats()
  }

  useEffect(() => {
    if (initialPrompt) {
      setInput(`Explícame sobre el documento "${initialPrompt}": `)
      onClearInitialPrompt?.()
    }
  }, [initialPrompt, onClearInitialPrompt])

  const handleSend = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim()
    if (!content || llmState.status === 'generating') return

    let currentChatId = activeChatId
    if (currentChatId === null) {
      currentChatId = await createChat(titleFrom(content))
      setActiveChatId(currentChatId)
      await refreshChats()
    }

    // Agregar mensaje del usuario a la base de datos
    await addMessage(currentChatId, 'user', content)
    const updatedMessages = await getMessages(currentChatId)
    setMessages(updatedMessages)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Rama 1: Modo Agente Autónomo (Herramientas, Python, Calculadora, Notas, etc.)
    if (agentMode) {
      setStreamingContent('Analizando y ejecutando con herramientas...')
      setLiveToolCalls([])
      setStreamingCitations([])

      try {
        const agentResult = await runAgentLoop(
          content,
          (step) => {
            if (step.toolName) {
              setLiveToolCalls((prev) => {
                const existingIdx = prev.findIndex(
                  (p) => p.name === step.toolName && !p.result && !p.error
                )
                if (existingIdx !== -1) {
                  const updated = [...prev]
                  updated[existingIdx] = {
                    name: step.toolName!,
                    args: step.toolArgs ?? {},
                    result: step.toolResult,
                    error: step.toolError,
                  }
                  return updated
                }
                return [
                  ...prev,
                  {
                    name: step.toolName!,
                    args: step.toolArgs ?? {},
                    result: step.toolResult,
                    error: step.toolError,
                  },
                ]
              })
            }
          },
          (partial) => {
            setStreamingContent(partial)
          }
        )

        await addMessage(
          currentChatId,
          'assistant',
          agentResult.finalContent,
          [],
          agentResult.toolCalls
        )
        const finalMessages = await getMessages(currentChatId)
        setMessages(finalMessages)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        await addMessage(
          currentChatId,
          'assistant',
          t('chat.error', { msg: errorMsg }),
          [],
          liveToolCalls
        )
        const finalMessages = await getMessages(currentChatId)
        setMessages(finalMessages)
      } finally {
        setStreamingContent(null)
        setLiveToolCalls([])
      }
      return
    }

    // Rama 2: Modo Chat / RAG directo con citas
    // Preparar historial previo para el modelo
    const history: HistoryMessage[] = updatedMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

    // Buscar si hay fragmentos de documentos relevantes en IndexedDB
    let promptMessages
    let activeCitations: Citation[] = []

    try {
      const searchResults = await searchChunks(content, 5, 0.22)
      if (searchResults.length > 0) {
        const rag = buildRagMessages(content, searchResults, history)
        promptMessages = rag.messages
        activeCitations = rag.citations
      } else {
        promptMessages = buildChatMessages(history)
      }
    } catch {
      promptMessages = buildChatMessages(history)
    }

    // Iniciar streaming
    setStreamingContent('')
    setStreamingCitations(activeCitations)
    try {
      const fullResponse = await llm.generate(promptMessages, (partial) => {
        setStreamingContent(partial)
      })
      if (fullResponse) {
        await addMessage(currentChatId, 'assistant', fullResponse, activeCitations)
        const finalMessages = await getMessages(currentChatId)
        setMessages(finalMessages)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await addMessage(
        currentChatId,
        'assistant',
        t('chat.error', { msg: errorMsg }),
        activeCitations,
      )
      const finalMessages = await getMessages(currentChatId)
      setMessages(finalMessages)
    } finally {
      setStreamingContent(null)
      setStreamingCitations([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isGenerating = llmState.status === 'generating'
  const isLoading = llmState.status === 'loading'

  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100 select-none app-backdrop">
      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-xs lg:hidden cursor-pointer"
        />
      )}

      {/* Barra lateral / Historial */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 sm:w-80 flex flex-col border-r border-ink-200/70 dark:border-white/[0.07] bg-white/90 dark:bg-ink-900/90 backdrop-blur-2xl transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Cabecera Sidebar */}
        <div className="p-4 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-[0_0_15px_rgba(0,245,160,0.35)]">
              <Logo size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-tight text-lg text-white">NODO</span>
              <span className="font-mono text-[9px] text-signal-400 tracking-wider uppercase">OFFGRID // v1.0</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettings()
                  setSidebarOpen(false)
                }}
                className="icon-btn"
                title="Configuración y Modelos"
              >
                <Icon name="settings" size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className="icon-btn"
              title={theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="icon-btn lg:hidden"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Botones de Navegación Sidebar */}
        <div className="p-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full btn-primary py-2.5 text-sm gap-2 cursor-pointer"
          >
            <Icon name="plus" size={16} />
            {t('chat.newChat')}
          </button>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                onOpenLibrary()
                setSidebarOpen(false)
              }}
              className="btn-ghost py-2 text-xs gap-1.5 border border-ink-200/70 dark:border-white/10 hover:border-signal-500/40 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer justify-center"
              title="Biblioteca de Documentos"
            >
              <Icon name="library" size={14} />
              <span>Docs</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenNotes()
                setSidebarOpen(false)
              }}
              className="btn-ghost py-2 text-xs gap-1.5 border border-ink-200/70 dark:border-white/10 hover:border-signal-500/40 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer justify-center"
              title="Notas Personales"
            >
              <Icon name="copy" size={14} />
              <span>Notas</span>
            </button>
          </div>
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto px-3 py-1 flex flex-col gap-1 scroll-thin">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 px-2 py-1">
            {t('chat.history')}
          </span>

          {chats.length === 0 ? (
            <p className="text-xs text-ink-400 px-2 py-4 italic">
              {t('chat.noChats')}
            </p>
          ) : (
            chats.map((c) => {
              const active = c.id === activeChatId
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveChatId(c.id)
                    setSidebarOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setActiveChatId(c.id)
                      setSidebarOpen(false)
                    }
                  }}
                  className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition text-left cursor-pointer ${
                    active
                      ? 'bg-signal-500/10 text-signal-700 dark:text-signal-300 font-medium'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="truncate pr-6">{c.title}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChat(c.id, e)}
                    className="absolute right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition p-1 hover:text-danger-500 rounded"
                    title={t('chat.deleteChat')}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Pie de Sidebar: Modelo Activo */}
        <div className="p-3 border-t border-ink-200/60 dark:border-white/5 bg-ink-100/30 dark:bg-white/[0.01]">
          <button
            type="button"
            onClick={() => {
              if (onOpenSettings) onOpenSettings()
              else onChangeModel()
              setSidebarOpen(false)
            }}
            className="w-full rounded-xl border border-ink-200/70 dark:border-white/5 p-2.5 flex items-center justify-between text-left hover:border-signal-500/40 transition group cursor-pointer"
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[11px] text-ink-400 font-medium flex items-center gap-1">
                <Icon name="cpu" size={12} />
                {t('header.changeModel')}
              </span>
              <span className="text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">
                {activeModelId ? labelForModelId(activeModelId) : t('status.notReady')}
              </span>
            </div>
            <Icon
              name="refresh"
              size={14}
              className="text-ink-400 group-hover:text-signal-400 transition shrink-0"
            />
          </button>
        </div>
      </aside>

      {/* Área Principal de Chat */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Cabecera Superior */}
        <header className="h-16 shrink-0 border-b border-white/[0.07] px-4 flex items-center justify-between bg-[#090d15]/85 backdrop-blur-2xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="icon-btn lg:hidden"
              title={t('header.history')}
            >
              <Icon name="menu" size={20} />
            </button>

            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-semibold truncate text-white flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal-400 shadow-[0_0_6px_#00f5a0]" />
                {activeChatId
                  ? chats.find((c) => c.id === activeChatId)?.title ?? t('chat.newChat')
                  : t('chat.newChat')}
              </h2>
              {activeModelId && (
                <span className="font-mono text-[10px] text-ink-400 truncate tracking-wide">
                  MODEL: {labelForModelId(activeModelId)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5 border border-ink-200/60 dark:border-white/10 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer"
              title="Abrir Biblioteca de Documentos"
            >
              <Icon name="library" size={14} />
              <span className="hidden sm:inline">Docs</span>
            </button>
            <button
              type="button"
              onClick={onOpenNotes}
              className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5 border border-ink-200/60 dark:border-white/10 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer"
              title="Abrir Notas Personales"
            >
              <Icon name="copy" size={14} />
              <span className="hidden sm:inline">Notas</span>
            </button>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="icon-btn"
                title="Configuración y Modelos"
              >
                <Icon name="settings" size={17} />
              </button>
            )}
            <OfflineBadge online={online} status={offlineStatus} llm={llmState} />
          </div>
        </header>

        {/* Banner de Carga del Modelo si está cargando */}
        {isLoading && (
          <div className="px-4 py-2 bg-signal-500/10 border-b border-signal-500/20 text-xs text-signal-700 dark:text-signal-300 flex items-center gap-3">
            <Icon name="refresh" size={14} className="animate-spin shrink-0" />
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between font-mono">
                <span>{llmState.progress?.text || t('boot.loading')}</span>
                <span>{Math.round((llmState.progress?.progress ?? 0) * 100)}%</span>
              </div>
              <ProgressBar value={llmState.progress?.progress ?? 0} />
            </div>
          </div>
        )}

        {/* Lista de Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-4 scroll-thin">
          {messages.length === 0 && !streamingContent ? (
            /* Estado Vacío / Pantalla de Bienvenida Estilo Sovereign Deck */
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-8 gap-5 animate-fade-up">
              {/* Núcleo Central Orbital */}
              <div className="relative flex items-center justify-center my-1 select-none">
                <div className="absolute size-28 rounded-full border border-signal-400/25 animate-pulse" />
                <div className="absolute size-36 rounded-full border border-white/[0.05]" />
                <div className="size-20 rounded-3xl bg-linear-to-br from-signal-400 via-signal-500 to-signal-600 flex items-center justify-center text-ink-950 shadow-[0_0_35px_rgba(0,245,160,0.4)] animate-glow">
                  <Logo size={42} />
                </div>
              </div>

              {/* Tag de Telemetría */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-300">
                <span className="size-1.5 rounded-full bg-signal-400 shadow-[0_0_6px_#00f5a0]" />
                <span>NODO OFFGRID // WEBGPU SOVEREIGN AGENT</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Asistente Inteligente <span className="text-gradient-emerald">100% Desconectado</span>
                </h3>
                <p className="text-xs sm:text-sm text-ink-400 max-w-lg mx-auto">
                  Inferencia local acelerada por WebGPU, RAG estilo NotebookLM y entorno Python sin conexión.
                </p>
              </div>

              {/* 4 Tarjetas de Capacidad Táctica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left my-1">
                {/* Card 1: RAG */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenLibrary()}
                  className="glass-card rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer group"
                >
                  <div className="size-9 rounded-xl bg-signal-500/10 border border-signal-500/30 text-signal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-[0_0_10px_-2px_rgba(0,245,160,0.25)]">
                    <Icon name="library" size={17} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white group-hover:text-signal-300 transition">
                      Document RAG (NotebookLM)
                    </span>
                    <span className="text-[11px] text-ink-400 leading-snug mt-0.5">
                      Sube PDFs y consulta con citaciones clicables [1], [2] a nivel de página.
                    </span>
                  </div>
                </div>

                {/* Card 2: Pyodide */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleSend('Ejecuta un script en Python para calcular los primeros 10 números de Fibonacci')}
                  className="glass-card rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer group"
                >
                  <div className="size-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-[0_0_10px_-2px_rgba(0,210,255,0.25)]">
                    <Icon name="cpu" size={17} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition">
                      Python Sandbox (Pyodide)
                    </span>
                    <span className="text-[11px] text-ink-400 leading-snug mt-0.5">
                      Ejecuta código científico en WebAssembly con watchdog de 15 segundos.
                    </span>
                  </div>
                </div>

                {/* Card 3: Math */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleSend('Calcula sqrt(256) + 14 * 3.5 usando la calculadora')}
                  className="glass-card rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer group"
                >
                  <div className="size-9 rounded-xl bg-ember-500/10 border border-ember-500/30 text-ember-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-[0_0_10px_-2px_rgba(255,184,0,0.25)]">
                    <Icon name="sparkles" size={17} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white group-hover:text-ember-300 transition">
                      Motor Matemático Seguro
                    </span>
                    <span className="text-[11px] text-ink-400 leading-snug mt-0.5">
                      Parser algebraico y trigonométrico sin usar llamadas eval() arbitrarias.
                    </span>
                  </div>
                </div>

                {/* Card 4: Emergency */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleSend('¿Cuáles son los pasos de RCP y torniquete en caso de emergencia?')}
                  className="glass-card rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer group"
                >
                  <div className="size-9 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-[0_0_10px_-2px_rgba(239,68,68,0.25)]">
                    <Icon name="shield" size={17} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white group-hover:text-danger-300 transition">
                      Kit de Supervivencia
                    </span>
                    <span className="text-[11px] text-ink-400 leading-snug mt-0.5">
                      Manuales de primeros auxilios, purificación de agua y protocolos PAS.
                    </span>
                  </div>
                </div>
              </div>

              {/* Sugerencias Rápidas de Agente */}
              <div className="w-full flex flex-col gap-1.5 mt-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-400 text-left px-1">
                  CONSULTAS RÁPIDAS:
                </span>
                {[
                  'Calcula sqrt(256) + 14 * 3.5 usando la calculadora',
                  'Ejecuta un script en Python para calcular los primeros 6 números primos',
                  '¿Cuáles son los pasos de RCP y torniquete en caso de emergencia?',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => void handleSend(sug)}
                    className="glass-card rounded-xl px-3.5 py-2.5 text-xs text-left text-ink-300 hover:text-white transition flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate pr-2">{sug}</span>
                    <Icon
                      name="send"
                      size={13}
                      className="text-ink-400 group-hover:text-signal-400 group-hover:translate-x-0.5 transition shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  role={m.role === 'assistant' ? 'assistant' : 'user'}
                  content={m.content}
                  citations={m.citations}
                  toolCalls={m.toolCalls}
                />
              ))}

              {/* Burbuja en streaming mientras la IA escribe */}
              {streamingContent !== null && (
                <MessageBubble
                  role="assistant"
                  content={streamingContent}
                  citations={streamingCitations}
                  toolCalls={liveToolCalls}
                  streaming
                />
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Entrada de Mensajes */}
        <div className="p-4 sm:p-6 pt-0 safe-bottom">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            <div className="command-bar rounded-2xl p-2.5 sm:p-3 flex items-end gap-2 transition">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={isLoading ? t('chat.waitModel') : 'Pregunta algo, pide un script en Python o consulta tus documentos...'}
                disabled={isLoading}
                className="flex-1 bg-transparent px-2 py-1 text-sm sm:text-base resize-none focus:outline-none placeholder:text-ink-400 max-h-44 scroll-thin text-ink-900 dark:text-white"
              />

              {isGenerating ? (
                <button
                  type="button"
                  onClick={() => llm.stop()}
                  className="rounded-xl bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 p-2.5 transition shrink-0 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  title={t('chat.stop')}
                >
                  <Icon name="stop" size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="btn-primary p-2.5 rounded-xl shrink-0 cursor-pointer"
                  title={t('chat.send')}
                >
                  <Icon name="send" size={18} />
                </button>
              )}
            </div>

            {/* Selector de Modo Agente vs Chat directo */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setAgentMode(!agentMode)}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[11px] font-semibold tracking-wider uppercase transition cursor-pointer ${
                  agentMode
                    ? 'bg-signal-500/15 text-signal-400 border border-signal-500/40 shadow-[0_0_12px_-2px_rgba(0,245,160,0.3)]'
                    : 'bg-white/5 text-ink-400 border border-white/10 hover:text-ink-200'
                }`}
                title="Activar/desactivar el bucle de herramientas autónomo (Python, Calculadora, Notas, etc.)"
              >
                <span className={`size-1.5 rounded-full ${agentMode ? 'bg-signal-400 shadow-[0_0_6px_#00f5a0]' : 'bg-ink-500'}`} />
                <span>MODO AGENTE {agentMode ? 'ON' : 'OFF'}</span>
              </button>

              <span className="font-mono text-[10px] text-ink-400 hidden sm:block tracking-wide">
                {agentMode
                  ? 'PYODIDE · CALC · RAG · NOTAS · EMERGENCIAS'
                  : '↵ Enviar · Shift + ↵ Salto de línea'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
