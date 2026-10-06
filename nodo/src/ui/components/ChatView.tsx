import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import type { ChatRecord, MessageRecord, Citation } from '../../types'
import {
  listChats,
  createChat,
  deleteChat,
  getMessages,
  addMessage,
  titleFrom,
} from '../../core/db/repo'
import { buildChatMessages, buildRagMessages, type HistoryMessage } from '../../core/agent/prompts'
import { searchChunks } from '../../core/rag/search'
import { hasNative, activeNativeModel, listNativeModels, nativeAction, nativeGenerate } from '../../core/native/bridge'
import { Icon, Logo } from './Icon'
import { MessageBubble } from './MessageBubble'

interface ChatViewProps {
  onOpenDrawer: () => void
  onOpenLibrary: () => void
  onOpenNotes: () => void
  onOpenModels: () => void
  onOpenSettings?: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  initialPrompt?: string | null
  onClearInitialPrompt?: () => void
}

export function ChatView({
  onOpenDrawer,
  onOpenLibrary,
  onOpenNotes,
  onOpenModels,
  onOpenSettings,
  theme,
  onToggleTheme,
  initialPrompt,
  onClearInitialPrompt,
}: ChatViewProps) {
  const [nativeModel, setNativeModel] = useState('')

  const [chats, setChats] = useState<ChatRecord[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  // Modelo nativo activo (puente JNI). Se relee al montar y cada 2s si no hay.
  useEffect(() => {
    const read = () => {
      try {
        setNativeModel(activeNativeModel())
      } catch {
        /* sin puente */
      }
    }
    read()
    if (!nativeModel) {
      const id = setInterval(read, 2000)
      return () => clearInterval(id)
    }
  }, [nativeModel])

  // Pantalla encendida mientras genera el motor nativo.
  useEffect(() => {
    if (!generating) return
    let lock: WakeLockSentinel | null = null
    let alive = true
    navigator.wakeLock?.request('screen').then((l) => {
      if (alive) lock = l
      else l.release()
    }).catch(() => {})
    return () => {
      alive = false
      lock?.release().catch(() => {})
    }
  }, [generating])

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // Identifica el envío vigente: si el usuario cambia de chat, el stream viejo
  // guarda en DB pero ya no toca la vista.
  const generationRef = useRef(0)

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

  // Auto-scroll al final, pero sin robar el scroll si el usuario subió
  useEffect(() => {
    const el = messagesEndRef.current?.parentElement
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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
    generationRef.current += 1
    nativeAction((n) => n.stopGenerate())
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

  /** Convierte mensajes OpenAI a texto plano para el motor nativo. */
  const messagesToText = (msgs: { role: string; content?: unknown }[]): string => {
    const textOf = (c: unknown): string => {
      if (typeof c === 'string') return c
      if (Array.isArray(c)) {
        return c
          .map((p) => (typeof p === 'string' ? p : typeof p?.text === 'string' ? (p.text as string) : ''))
          .join('')
      }
      return ''
    }
    const lines: string[] = []
    for (const m of msgs) {
      if (m.role === 'system') lines.push(`Instrucciones: ${textOf(m.content)}`)
      else if (m.role === 'assistant') lines.push(`Asistente: ${textOf(m.content)}`)
      else lines.push(`Usuario: ${textOf(m.content)}`)
    }
    return lines.join('\n\n')
  }

  const handleSend = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim()
    if (!content || generating) return
    if (!hasNative() || !nativeModel) {
      onOpenModels()
      return
    }
    const gen = ++generationRef.current
    const isCurrent = () => gen === generationRef.current

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

    // Historial + RAG local (embeddings en el dispositivo)
    const history: HistoryMessage[] = updatedMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

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

    // Streaming desde el motor nativo (llama.cpp)
    const promptText = messagesToText(promptMessages)
    setGenerating(true)
    setStreamingContent('')
    setStreamingCitations(activeCitations)
    await new Promise<void>((resolve) => {
      const stop = nativeGenerate(promptText, 512, (kind, text) => {
        if (!isCurrent()) {
          resolve()
          return
        }
        if (kind === 'token') {
          setStreamingContent(text)
        } else if (kind === 'done') {
          void (async () => {
            if (text) {
              await addMessage(currentChatId, 'assistant', text, activeCitations)
              if (!isCurrent()) {
                resolve()
                return
              }
              const finalMessages = await getMessages(currentChatId)
              setMessages(finalMessages)
            }
            if (isCurrent()) {
              setStreamingContent(null)
              setStreamingCitations([])
              setGenerating(false)
            }
            resolve()
          })()
        } else if (kind === 'error') {
          void (async () => {
            await addMessage(currentChatId, 'assistant', t('chat.error', { msg: text }), activeCitations)
            if (!isCurrent()) {
              resolve()
              return
            }
            const finalMessages = await getMessages(currentChatId)
            setMessages(finalMessages)
            setStreamingContent(null)
            setStreamingCitations([])
            setGenerating(false)
            resolve()
          })()
        }
      })
      stopRef.current = stop
    })
    stopRef.current = null
  }

  const handleStop = () => {
    generationRef.current += 1
    try {
      stopRef.current?.()
    } catch {
      /* noop */
    }
    stopRef.current = null
    setStreamingContent(null)
    setStreamingCitations([])
    setGenerating(false)
    void refreshChats()
  }


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isGenerating = generating

  const nativeModelLabel = (): string => {
    if (!nativeModel) return ''
    try {
      const found = listNativeModels().find((m) => m.id === nativeModel)
      return found ? found.label : nativeModel
    } catch {
      return nativeModel
    }
  }

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
              <span className="font-display font-bold tracking-tight text-lg text-ink-900 dark:text-white">NODO</span>
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
                aria-label="Configuración y Modelos" title="Configuración y Modelos"
              >
                <Icon name="settings" size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className="icon-btn"
              aria-label={theme === 'dark' ? t('header.themeLight') : t('header.themeDark')} title={theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
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
              aria-label="Biblioteca de Documentos" title="Biblioteca de Documentos"
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
              aria-label="Notas Personales" title="Notas Personales"
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
                    generationRef.current += 1
                    nativeAction((n) => n.stopGenerate())
                    setActiveChatId(c.id)
                    setSidebarOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      generationRef.current += 1
                      nativeAction((n) => n.stopGenerate())
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
                    aria-label={t('chat.deleteChat')} title={t('chat.deleteChat')}
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
              onOpenModels()
              setSidebarOpen(false)
            }}
            className="w-full rounded-xl border border-ink-200/70 dark:border-white/5 p-2.5 flex items-center justify-between text-left hover:border-signal-500/40 transition group cursor-pointer"
            aria-label={t('header.changeModel')} title={t('header.changeModel')}
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[11px] text-ink-400 font-medium flex items-center gap-1">
                <Icon name="cpu" size={12} />
                {t('header.changeModel')}
              </span>
              <span className="text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">
                {nativeModel ? nativeModelLabel() : t('status.notReady')}
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
              onClick={onOpenDrawer}
              className="size-9 rounded-xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shrink-0 cursor-pointer"
              aria-label="Abrir menú" title="Abrir menú"
            >
              <Logo size={20} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="icon-btn lg:hidden"
              aria-label={t('header.history')} title={t('header.history')}
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
              {nativeModel ? (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="font-mono text-[10px] text-ink-400 truncate tracking-wide hover:text-signal-400 transition cursor-pointer"
                  aria-label={t('header.changeModel')} title={t('header.changeModel')}
                >
                  IA: {nativeModelLabel()}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="font-mono text-[10px] text-ember-400 truncate tracking-wide hover:text-ember-300 transition cursor-pointer"
                  aria-label="Descargar IA" title="Descargar IA"
                >
                  SIN IA · TOCA PARA DESCARGAR
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5 border border-ink-200/60 dark:border-white/10 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer"
              aria-label="Abrir Biblioteca de Documentos" title="Abrir Biblioteca de Documentos"
            >
              <Icon name="library" size={14} />
              <span className="hidden sm:inline">Docs</span>
            </button>
            <button
              type="button"
              onClick={onOpenNotes}
              className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5 border border-ink-200/60 dark:border-white/10 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer"
              aria-label="Abrir Notas Personales" title="Abrir Notas Personales"
            >
              <Icon name="copy" size={14} />
              <span className="hidden sm:inline">Notas</span>
            </button>
            <button
              type="button"
              onClick={onOpenModels}
              className="btn-ghost text-xs px-2.5 py-1.5 gap-1.5 border border-ink-200/60 dark:border-white/10 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer"
              aria-label="Abrir Modelos de IA" title="Abrir Modelos de IA"
            >
              <Icon name="cpu" size={14} />
              <span className="hidden sm:inline">IA</span>
            </button>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="icon-btn"
                aria-label="Configuración y Modelos" title="Configuración y Modelos"
              >
                <Icon name="settings" size={17} />
              </button>
            )}
          </div>
        </header>

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
                <span>NODO OFFGRID // MOTOR NATIVO</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Asistente Inteligente <span className="text-gradient-emerald">100% Desconectado</span>
                </h3>
                <p className="text-xs sm:text-sm text-ink-400 max-w-lg mx-auto">
                  Inferencia local en tu teléfono (llama.cpp), documentos con citas y notas privadas.
                </p>
              </div>

              {!nativeModel && (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="btn-primary px-6 py-3 text-sm cursor-pointer"
                >
                  <Icon name="download" size={16} />
                  Descargar tu IA (una sola vez)
                </button>
              )}

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
                enterKeyHint="send"
                autoCapitalize="sentences"
                spellCheck
                rows={1}
                aria-label="Entrada de mensaje" placeholder={nativeModel ? 'Pregunta algo o consulta tus documentos...' : 'Primero descarga tu IA en Modelos...'}
                disabled={!nativeModel}
                className="flex-1 bg-transparent px-2 py-1 text-sm sm:text-base resize-none focus:outline-none placeholder:text-ink-400 max-h-44 scroll-thin text-ink-900 dark:text-white"
              />

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-xl bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 p-2.5 transition shrink-0 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  aria-label={t('chat.stop')} title={t('chat.stop')}
                >
                  <Icon name="stop" size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || !nativeModel}
                  className="btn-primary p-2.5 rounded-xl shrink-0 cursor-pointer"
                  aria-label={t('chat.send')} title={t('chat.send')}
                >
                  <Icon name="send" size={18} />
                </button>
              )}
            </div>

            {/* Estado del motor + ayuda de teclado */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={onOpenModels}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[11px] font-semibold tracking-wider uppercase transition cursor-pointer bg-signal-500/15 text-signal-400 border border-signal-500/40"
                aria-label="Abrir Modelos de IA" title="Abrir Modelos de IA"
              >
                <span className="size-1.5 rounded-full bg-signal-400 shadow-[0_0_6px_#00f5a0]" />
                <span>{nativeModel ? `IA NATIVA · ${nativeModelLabel()}` : 'SIN IA · DESCARGAR'}</span>
              </button>

              <span className="font-mono text-[10px] text-ink-400 hidden sm:block tracking-wide">
                ↵ Enviar · Shift + ↵ Salto de línea
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
