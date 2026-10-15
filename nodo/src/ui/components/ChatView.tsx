import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import type { ChatRecord, MessageRecord, Citation, Attachment, GenerationStats } from '../../types'
import { processChatAttachment } from '../../core/files/fileExtractor'
import {
  listChats,
  createChat,
  deleteChat,
  renameChat,
  deleteMessage,
  getMessages,
  addMessage,
  titleFrom,
} from '../../core/db/repo'
import { buildChatMessages, buildRagMessages, type HistoryMessage } from '../../core/agent/prompts'
import { searchChunks } from '../../core/rag/search'
import { hasNative, activeNativeModel, setActiveNativeModel, listNativeModels, nativeAction, nativeGenerate, nativeAgentTask, nativeDictation } from '../../core/native/bridge'
import { routeQuery, type RouteDecision } from '../../core/llm/router'
import { extractCodeBlock } from '../../core/code/codePipeline'
import { queryCloudApi } from '../../core/llm/cloud'
import { setIsland, haptic } from '../../core/native/island'
import { Icon, Logo } from './Icon'
import { MessageBubble } from './MessageBubble'

interface ChatViewProps {
  onOpenDrawer: () => void
  onOpenLibrary: () => void
  onOpenCode?: (payload?: { code: string; lang?: 'javascript' | 'python' | 'html'; autoRun?: boolean }) => void
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
  onOpenCode,
  onOpenNotes,
  onOpenModels,
  onOpenSettings,
  theme,
  onToggleTheme,
  initialPrompt,
  onClearInitialPrompt,
}: ChatViewProps) {
  const [nativeModel, setNativeModel] = useState('')

  interface QueuedMessage {
    id: string
    content: string
    attachments: Attachment[]
  }

  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([])
  const [thinkingSeconds, setThinkingSeconds] = useState(0)
  const [autoRouter, setAutoRouter] = useState(true)
  const [routeDecision, setRouteDecision] = useState<RouteDecision | null>(null)
  const [lastCloudOpportunity, setLastCloudOpportunity] = useState<{ query: string; chatId: number } | null>(null)
  const [cloudLoading, setCloudLoading] = useState(false)

  const [chats, setChats] = useState<ChatRecord[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [agentOn, setAgentOn] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [dictNotice, setDictNotice] = useState<string | null>(null)
  const [chatError, setChatError] = useState<{ message: string; retryContent: string } | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [processingFiles, setProcessingFiles] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  const isUserScrolledUp = useRef(false)
  const dictateStop = useRef<(() => void) | null>(null)
  const dictateBase = useRef('')
  const handleStopRef = useRef<(clearAllQueue?: boolean) => void>(() => {})

  function isDateTimeQuery(text: string): boolean {
    const t = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return (
      /^(que|cual es|dime el|dime la)\s+(dia|fecha|hora|ano|mes)\s*(es|tenemos|estamos|de hoy)?/i.test(t) ||
      /^(que\s+dia\s+(es\s+)?hoy|que\s+hora\s+es|fecha\s+de\s+hoy|hora\s+actual|dia\s+actual|fecha\s+actual|que\s+ano\s+es|que\s+mes\s+es)/i.test(t) ||
      /^(what\s+day\s+is\s+it|what('s|\s+is)\s+the\s+(time|date)|current\s+time|today'?s\s+date)/i.test(t)
    )
  }

  function getInstantDateTimeAnswer(): string {
    const now = new Date()
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ]
    const dayName = dayNames[now.getDay()]
    const dayNum = now.getDate()
    const monthName = monthNames[now.getMonth()]
    const year = now.getFullYear()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    return `📅 **Hoy es ${dayName}, ${dayNum} de ${monthName} de ${year}**.\n\n⏰ **Hora local:** ${hours}:${minutes}:${seconds} (${tz})\n\n*(Respuesta instantánea 0ms mediante herramienta de reloj del sistema)*`
  }

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    setProcessingFiles(true)
    haptic('selection')
    try {
      const list = Array.from(files)
      const processed: Attachment[] = []
      for (const f of list) {
        try {
          const att = await processChatAttachment(f)
          processed.push(att)
        } catch (itemErr) {
          console.warn('Error procesando adjunto:', f.name, itemErr)
          processed.push({
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: f.name,
            type: 'file',
            mimeType: f.type || 'application/octet-stream',
            size: f.size,
            textContent: `[Archivo: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]`,
          })
        }
      }
      setPendingAttachments((prev) => [...prev, ...processed])
      haptic('success')
    } catch (e) {
      console.error('Error al seleccionar archivos:', e)
    } finally {
      setProcessingFiles(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
    haptic('selection')
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const filesToUpload: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item && item.kind === 'file') {
        const file = item.getAsFile()
        if (file) filesToUpload.push(file)
      }
    }
    if (filesToUpload.length > 0) {
      e.preventDefault()
      void handleFilesSelected(filesToUpload)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void handleFilesSelected(e.dataTransfer.files)
    }
  }

  const toggleDictation = () => {
    if (dictating) {
      try {
        dictateStop.current?.()
      } catch {
        /* noop */
      }
      dictateStop.current = null
      setDictating(false)
      setIsland({ mode: 'hidden' })
      return
    }
    dictateBase.current = input
    setDictNotice(null)
    setDictating(true)
    haptic('selection')
    setIsland({ mode: 'listening', label: 'Escuchando…', onTap: () => toggleDictation() })
    const stop = nativeDictation((kind, text) => {
      if (kind === 'partial') {
        setInput(`${dictateBase.current}${dictateBase.current ? ' ' : ''}${text}`)
      } else if (kind === 'final') {
        setInput(`${dictateBase.current}${dictateBase.current ? ' ' : ''}${text} `)
        dictateBase.current = ''
        setDictating(false)
        setIsland({ mode: 'hidden' })
        haptic('success')
      } else if (kind === 'need-model') {
        nativeAction((n) => n.downloadVoskModel())
        setDictNotice('Descargando voz en español (~38 MB)… pulsa el micrófono de nuevo al terminar.')
        setDictating(false)
        setIsland({ mode: 'hidden' })
      } else if (kind === 'error') {
        setDictNotice(text === 'timeout' ? 'No se escuchó nada.' : `Micrófono: ${text}`)
        setDictating(false)
        setIsland({ mode: 'hidden' })
        haptic('warning')
      } else if (kind === 'start') {
        setIsland({ mode: 'listening', label: 'Escuchando…', onTap: () => toggleDictation() })
      }
    })
    dictateStop.current = stop
  }
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([])
  const [streamingStats, setStreamingStats] = useState<GenerationStats | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatQuery, setChatQuery] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
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

  // Texto compartido desde otras apps (Compartir → Jinx).
  useEffect(() => {
    const pull = () => {
      try {
        const t = window.NodoNative?.consumeSharedText()
        if (t) setInput((prev) => (prev ? `${prev}\n${t}` : t))
      } catch {
        /* sin puente */
      }
    }
    pull()
    const onEvent = () => pull()
    const onVisible = () => {
      if (document.visibilityState === 'visible') pull()
    }
    window.addEventListener('nodo-shared-text', onEvent)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('nodo-shared-text', onEvent)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Temporizador visible en la isla y en la interfaz mientras la IA piensa.
  useEffect(() => {
    if (!generating) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000)
      setThinkingSeconds(s)
      setIsland({
        mode: 'thinking',
        label: agentOn ? `Agente · ${s}s` : `IA · ${s}s`,
        onCancel: () => handleStopRef.current(true),
      })
    }, 1000)
    return () => clearInterval(id)
  }, [generating, agentOn])

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
    let alive = true
    listChats().then((list) => {
      if (!alive) return
      setChats(list)
      if (list.length > 0 && list[0]) {
        setActiveChatId(list[0].id)
      } else {
        setActiveChatId(null)
        setMessages([])
      }
    })
    return () => {
      alive = false
    }
  }, [])

  // Cargar mensajes cuando cambia el chat activo
  useEffect(() => {
    let alive = true
    if (activeChatId !== null) {
      getMessages(activeChatId).then((msgs) => {
        if (alive) setMessages(msgs)
      })
    } else {
      queueMicrotask(() => {
        if (alive) setMessages([])
      })
    }
    return () => {
      alive = false
    }
  }, [activeChatId])

  // Auto-scroll al final, pero sin robar el scroll si el usuario subió
  useEffect(() => {
    const el = messagesEndRef.current?.parentElement
    if (!el || isUserScrolledUp.current) return
    if (streamingContent !== null) {
      // Durante streaming de tokens, scroll instantáneo para no batallar con gestos
      el.scrollTop = el.scrollHeight
    } else {
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

  const handleRenameChat = async (id: number) => {
    await renameChat(id, editTitle)
    setEditingId(null)
    setEditTitle('')
    await refreshChats()
  }

  const handleShareChat = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const chat = chats.find((c) => c.id === id)
    const msgs = await getMessages(id)
    const body = msgs.map((m) => `${m.role === 'assistant' ? 'IA' : 'Yo'}: ${m.content}`).join('\n\n')
    const text = `${chat?.title ?? 'Conversación'}\n\n${body}`
    const done = nativeAction((n) => n.shareText(chat?.title ?? 'Conversación Jinx', text))
    if (done !== 'ok') {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        /* sin portapapeles */
      }
    }
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
      queueMicrotask(() => {
        const p = initialPrompt.trim()
        const isDocName =
          !p.startsWith('Sobre mi nota') &&
          !p.startsWith('Analiza') &&
          !p.startsWith('Explícame') &&
          !p.includes('\n') &&
          p.length < 80

        if (isDocName) {
          setInput(`Explícame sobre el documento "${p}": `)
        } else {
          setInput(p)
        }
        onClearInitialPrompt?.()
      })
    }
  }, [initialPrompt, onClearInitialPrompt])

  const handleSend = async (textToSend?: string, attachmentsToSend?: Attachment[]) => {
    const rawContent = (textToSend ?? input).trim()
    const currentAttachments = attachmentsToSend ?? [...pendingAttachments]
    if (!rawContent && currentAttachments.length === 0) return

    // COLA DE MENSAJES: Si ya hay una generación activa o enviándose, encolar en vez de bloquear o perder
    if (generating || sendingRef.current) {
      const queuedItem: QueuedMessage = {
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content: rawContent,
        attachments: currentAttachments,
      }
      setMessageQueue((prev) => [...prev, queuedItem])
      setInput('')
      setPendingAttachments([])
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      haptic('selection')
      return
    }

    if (!hasNative() || !nativeModel) {
      onOpenModels()
      return
    }

    const content =
      rawContent ||
      (currentAttachments.some((a) => a.type === 'image')
        ? 'Analiza y describe la imagen adjunta en detalle.'
        : 'Analiza el documento adjunto en detalle.')

    setPendingAttachments([])
    sendingRef.current = true
    setChatError(null)

    // RESPUESTA DETERMINISTA INSTANTÁNEA (0ms, 0 tokens) para fecha y hora del sistema
    if (isDateTimeQuery(content)) {
      try {
        let currentChatId = activeChatId
        if (currentChatId === null) {
          currentChatId = await createChat(titleFrom(content))
          setActiveChatId(currentChatId)
          await refreshChats()
        }
        await addMessage(currentChatId, 'user', content, [], [], currentAttachments)
        const instantReply = getInstantDateTimeAnswer()
        await addMessage(currentChatId, 'assistant', instantReply, [])
        const finalMessages = await getMessages(currentChatId)
        setMessages(finalMessages)
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        haptic('success')
      } finally {
        sendingRef.current = false
        drainQueue()
      }
      return
    }

    // Contexto multimodal y de documentos para el LLM
    let fullQueryWithContext = content
    if (currentAttachments.length > 0) {
      const attachmentsText = currentAttachments
        .map((a) => {
          if (a.type === 'image' && a.textContent) {
            return a.textContent
          }
          if (a.textContent) {
            return `[DOCUMENTO ADJUNTO: "${a.name}" (${(a.size / 1024).toFixed(1)} KB)]:\n${a.textContent.slice(0, 4000)}`
          }
          return `[ARCHIVO ADJUNTO: "${a.name}"]`
        })
        .join('\n\n')

      fullQueryWithContext = `${attachmentsText}\n\n[INSTRUCCIÓN DEL USUARIO]:\n${content}`
    }

    if (agentOn) {
      try {
        await handleAgentSend(fullQueryWithContext, content, currentAttachments)
      } finally {
        sendingRef.current = false
      }
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

    // Agregar mensaje del usuario a la base de datos con adjuntos
    await addMessage(currentChatId, 'user', content, [], [], currentAttachments)
    const updatedMessages = await getMessages(currentChatId)
    setMessages(updatedMessages)
    setInput('')
    isUserScrolledUp.current = false
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Historial + RAG local (embeddings en el dispositivo)
    const history: HistoryMessage[] = updatedMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

    // Router automático por reglas (sin llamadas a LLM)
    const hasImage = currentAttachments.some((a) => a.type === 'image')
    const downloadedModels = listNativeModels().filter((m) => m.state === 'ready' || m.state === 'active').map((m) => m.id)
    const decision = autoRouter
      ? routeQuery(content, hasImage, downloadedModels, nativeModel)
      : null

    if (decision) {
      setRouteDecision(decision)
      if (decision.targetModelId && decision.targetModelId !== nativeModel) {
        setActiveNativeModel(decision.targetModelId)
        setNativeModel(decision.targetModelId)
      }
    }

    const enableThinking = decision?.enableThinking ?? false
    const thinkingBudget = decision?.thinkingBudget ?? 0

    let promptMessages
    let activeCitations: Citation[] = []

    try {
      const searchResults = await searchChunks(content, 5, 0.22)
      if (searchResults.length > 0) {
        const rag = buildRagMessages(fullQueryWithContext, searchResults, history)
        promptMessages = rag.messages
        activeCitations = rag.citations
      } else {
        promptMessages = buildChatMessages(history, 6, { enableThinking, thinkingBudget, intent: decision?.intent })
        if (currentAttachments.length > 0 && promptMessages.length > 0) {
          const last = promptMessages[promptMessages.length - 1]
          if (last) last.content = fullQueryWithContext
        }
      }
    } catch {
      promptMessages = buildChatMessages(history, 6, { enableThinking, thinkingBudget, intent: decision?.intent })
      if (currentAttachments.length > 0 && promptMessages.length > 0) {
        const last = promptMessages[promptMessages.length - 1]
        if (last) last.content = fullQueryWithContext
      }
    }

    // Serializar mensajes como JSON para que el motor nativo aplique el template oficial del GGUF
    const promptPayload = JSON.stringify(promptMessages)
    const maxTokensLimit = decision?.intent === 'codegen' ? 2048 : (decision?.category === 'fast' ? 256 : (decision?.category === 'complex' ? 1024 : 512))

    setGenerating(true)
    haptic('selection')
    setIsland({
      mode: 'thinking',
      label: agentOn
        ? 'Agente trabajando…'
        : decision?.category === 'fast'
          ? '⚡ Qwen respondiendo…'
          : decision?.category === 'complex'
            ? '🧠 Gemma razonando…'
            : 'IA pensando…',
      onCancel: () => handleStopRef.current(true),
    })
    setStreamingContent('')
    setStreamingCitations(activeCitations)
    setStreamingStats(null)
    try {
      let latestStats: GenerationStats | undefined = undefined
      await new Promise<void>((resolve) => {
        const stop = nativeGenerate(promptPayload, maxTokensLimit, (kind, text) => {
          if (!isCurrent()) {
            resolve()
            return
          }
          if (kind === 'stats') {
            try {
              const parsed = JSON.parse(text) as GenerationStats
              latestStats = parsed
              setStreamingStats(parsed)
            } catch {
              /* ignore parse error */
            }
          } else if (kind === 'token') {
            setStreamingContent(text)
          } else if (kind === 'done') {
            void (async () => {
              if (text) {
                if (text.startsWith('[sin modelo cargado]') || text.startsWith('[error:')) {
                  setChatError({
                    message: text.replace(/^\[|\]$/g, ''),
                    retryContent: content,
                  })
                } else {
                  await addMessage(currentChatId, 'assistant', text, activeCitations, [], [], latestStats)
                  if (!isCurrent()) {
                    resolve()
                    return
                  }
                  const finalMessages = await getMessages(currentChatId)
                  setMessages(finalMessages)

                  if (decision?.intent === 'codegen' && onOpenCode) {
                    const extracted = extractCodeBlock(text, content)
                    if (extracted.code) {
                      onOpenCode({
                        code: extracted.code,
                        lang: extracted.detectedLang,
                        autoRun: extracted.detectedLang === 'html',
                      })
                    }
                  }

                  if (decision?.isCloudRecommended && typeof navigator !== 'undefined' && navigator.onLine) {
                    setLastCloudOpportunity({ query: content, chatId: currentChatId })
                  } else {
                    setLastCloudOpportunity(null)
                  }
                }
              }
              if (isCurrent()) finishGeneration()
              resolve()
            })()
          } else if (kind === 'error') {
            void (async () => {
              setChatError({
                message: text || 'Error al generar respuesta',
                retryContent: content,
              })
              if (isCurrent()) finishGeneration()
              resolve()
            })()
          }
        })
        stopRef.current = stop
      })
    } finally {
      sendingRef.current = false
    }
    stopRef.current = null
  }

  /** Consulta opcional a API en la nube (Gemini / Claude) cuando se solicita respuesta avanzada. */
  const handleCloudFallback = async (queryText: string) => {
    if (!activeChatId) return
    setCloudLoading(true)
    haptic('selection')
    setIsland({
      mode: 'thinking',
      label: 'Consultando nube (Gemini/Claude)…',
      onCancel: () => setCloudLoading(false),
    })
    try {
      const res = await queryCloudApi(queryText)
      if (res.ok) {
        await addMessage(activeChatId, 'assistant', `[✨ Respuesta avanzada en la nube · Gemini/Claude]\n\n${res.text}`)
        const updated = await getMessages(activeChatId)
        setMessages(updated)
        setLastCloudOpportunity(null)
        haptic('success')
      } else {
        setChatError({
          message: res.error || 'Error al conectar con la API en la nube',
          retryContent: queryText,
        })
      }
    } finally {
      setCloudLoading(false)
      setIsland({ mode: 'hidden' })
    }
  }

  /** Envío en modo agente: el modelo usa herramientas del teléfono con soporte multimodal. */
  const handleAgentSend = async (
    fullQuery: string,
    displayContent: string = fullQuery,
    attachments: Attachment[] = []
  ) => {
    const gen = ++generationRef.current
    const isCurrent = () => gen === generationRef.current

    let currentChatId = activeChatId
    if (currentChatId === null) {
      currentChatId = await createChat(titleFrom(displayContent))
      setActiveChatId(currentChatId)
      await refreshChats()
    }
    await addMessage(currentChatId, 'user', displayContent, [], [], attachments)
    const updatedMessages = await getMessages(currentChatId)
    setMessages(updatedMessages)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setGenerating(true)
    setStreamingContent('Agente trabajando…')
    setStreamingCitations([])
    await new Promise<void>((resolve) => {
      const stop = nativeAgentTask(fullQuery, (kind, text) => {
        if (!isCurrent()) {
          resolve()
          return
        }
        if (kind === 'step') {
          setStreamingContent((prev) => `${prev ?? ''}\n• ${text}`.slice(-1500))
        } else if (kind === 'done') {
          void (async () => {
            const clean = text.replace(/^FINAL:\s*/, '')
            if (text) {
              await addMessage(currentChatId, 'assistant', clean || text, [])
              if (!isCurrent()) {
                resolve()
                return
              }
              setMessages(await getMessages(currentChatId))
            }
            if (isCurrent()) finishGeneration()
            resolve()
          })()
        } else if (kind === 'error') {
          void (async () => {
            setChatError({
              message: text || 'Error en tarea del agente',
              retryContent: displayContent,
            })
            if (isCurrent()) finishGeneration()
            resolve()
          })()
        }
      })
      stopRef.current = stop
    })
    stopRef.current = null
  }

  const drainQueue = () => {
    setMessageQueue((prev) => {
      if (prev.length === 0) return prev
      const [next, ...rest] = prev
      setTimeout(() => {
        if (next) void handleSend(next.content, next.attachments)
      }, 60)
      return rest
    })
  }

  const finishGeneration = () => {
    setStreamingContent(null)
    setStreamingCitations([])
    setStreamingStats(null)
    setGenerating(false)
    setThinkingSeconds(0)
    sendingRef.current = false
    setIsland({ mode: 'hidden' })
    drainQueue()
  }

  const canRegenerate =
    !generating &&
    messages.length >= 2 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    messages[messages.length - 2]?.role === 'user'

  const handleRegenerate = async () => {
    if (!canRegenerate) return
    const lastAssistant = messages[messages.length - 1]!
    const lastUser = messages[messages.length - 2]!
    generationRef.current += 1
    await deleteMessage(lastAssistant.id)
    setMessages(messages.slice(0, -1))
    await handleSend(lastUser.content)
  }

  const handleStop = (clearAllQueue = false) => {
    generationRef.current += 1
    try {
      stopRef.current?.()
    } catch {
      /* noop */
    }
    stopRef.current = null
    try {
      window.NodoNative?.stopGenerate?.()
      window.NodoNative?.stopAgent?.()
    } catch {
      /* noop */
    }
    sendingRef.current = false
    setStreamingContent(null)
    setStreamingCitations([])
    setGenerating(false)
    setIsland({ mode: 'hidden' })
    if (clearAllQueue) {
      setMessageQueue([])
    } else {
      drainQueue()
    }
    void refreshChats()
  }

  useEffect(() => {
    handleStopRef.current = handleStop
  })


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
    <div className="flex h-dvh w-full overflow-hidden bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100 select-none app-backdrop">
      {/* Overlay para cerrar el menú desplegable */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú de chats"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs cursor-pointer animate-fade-in"
        />
      )}

      {/* Menú Desplegable / Historial y Nuevo Chat */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] flex flex-col border-r border-black/10 dark:border-white/[0.08] bg-white/95 dark:bg-black/95 backdrop-blur-2xl transition-transform duration-300 ease-in-out shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera Sidebar Desplegable */}
        <div className="p-4 border-b border-black/10 dark:border-white/[0.07] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-black/90 border border-white/20 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)] overflow-hidden">
              <Logo size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-tight text-lg text-ink-900 dark:text-white">Jinx</span>
              <span className="font-mono text-[9px] text-ink-500 dark:text-white/50 tracking-wider uppercase">OFFGRID // v1.0</span>
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
              className="icon-btn hover:text-black dark:hover:text-white rounded-full"
              aria-label="Ocultar menú"
              title="Ocultar menú"
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
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                onOpenLibrary()
                setSidebarOpen(false)
              }}
              className="btn-ghost py-2 text-xs gap-1 border border-ink-200/70 dark:border-white/10 hover:border-signal-500/40 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer justify-center"
              aria-label="Biblioteca de Documentos" title="Biblioteca de Documentos"
            >
              <Icon name="library" size={14} />
              <span>Docs</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenCode?.()
                setSidebarOpen(false)
              }}
              className="btn-ghost py-2 text-xs gap-1 border border-ink-200/70 dark:border-white/10 hover:border-signal-500/40 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer justify-center"
              aria-label="Entorno de Código" title="Entorno de Código"
            >
              <Icon name="code" size={14} />
              <span>Código</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenNotes()
                setSidebarOpen(false)
              }}
              className="btn-ghost py-2 text-xs gap-1 border border-ink-200/70 dark:border-white/10 hover:border-signal-500/40 text-ink-700 dark:text-ink-200 hover:text-signal-400 cursor-pointer justify-center"
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
          {chats.length > 3 && (
            <div className="px-2 pb-1">
              <input
                type="search"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Filtrar…"
                aria-label="Filtrar conversaciones"
                className="w-full rounded-lg border border-ink-200/70 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] py-1.5 px-3 text-xs text-ink-900 dark:text-white focus:border-signal-500 focus:outline-none"
              />
            </div>
          )}

          {chats.length === 0 ? (
            <p className="text-xs text-ink-400 px-2 py-4 italic">
              {t('chat.noChats')}
            </p>
          ) : (
            chats
              .filter((c) => c.title.toLowerCase().includes(chatQuery.trim().toLowerCase()))
              .map((c) => {
              const active = c.id === activeChatId
              const editing = editingId === c.id
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (editing) return
                    generationRef.current += 1
                    nativeAction((n) => n.stopGenerate())
                    setActiveChatId(c.id)
                    setSidebarOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !editing) {
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
                  {editing ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') void handleRenameChat(c.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => setEditingId(null)}
                      aria-label="Renombrar conversación"
                      className="w-full rounded-lg border border-signal-500/50 bg-transparent px-2 py-1 text-sm focus:outline-none"
                    />
                  ) : (
                    <>
                      <span className="truncate pr-16">{c.title}</span>
                      <span className="absolute right-2 flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(c.id)
                            setEditTitle(c.title)
                          }}
                          className="p-1 hover:text-signal-400 rounded"
                          aria-label="Renombrar" title="Renombrar"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleShareChat(c.id, e)}
                          className="p-1 hover:text-signal-400 rounded"
                          aria-label="Compartir" title="Compartir"
                        >
                          <Icon name="share" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteChat(c.id, e)}
                          className="p-1 hover:text-danger-500 rounded"
                          aria-label={t('chat.deleteChat')} title={t('chat.deleteChat')}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </span>
                    </>
                  )}
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
      <main
        className="flex-1 flex flex-col h-full overflow-hidden relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Overlay de arrastrar y soltar archivos */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-6 pointer-events-none animate-fade-in border-2 border-dashed border-white/50 m-4 rounded-3xl">
            <div className="size-16 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center animate-bounce">
              <Icon name="upload" size={32} />
            </div>
            <span className="font-display font-bold text-xl text-white">Suelta tus archivos o imágenes aquí</span>
            <span className="font-mono text-xs text-ink-300">Jinx procesará el contenido con visión multimodal y RAG local</span>
          </div>
        )}
        {/* Cabecera Superior */}
        <header className="h-16 shrink-0 border-b border-black/5 dark:border-white/[0.07] px-4 flex items-center justify-between bg-white/80 dark:bg-black/75 backdrop-blur-2xl z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Botón para desplegar el menú de nuevo chat y conversaciones */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="icon-btn rounded-full active:scale-90"
              aria-label="Abrir menú de nuevo chat e historial"
              title="Abrir menú de nuevo chat e historial"
            >
              <Icon name="menu" size={20} />
            </button>

            <button
              type="button"
              onClick={onOpenDrawer}
              className="size-9 rounded-full bg-black/90 border border-white/20 flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.2)] shrink-0 cursor-pointer overflow-hidden active:scale-95 transition-transform"
              aria-label="Abrir menú" title="Abrir menú"
            >
              <Logo size={22} />
            </button>

            {/* Botón rápido "+ Nuevo chat" */}
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-full text-xs px-2.5 sm:px-3 py-1.5 gap-1.5 border border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.08] text-ink-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/[0.15] active:scale-95 transition cursor-pointer flex items-center font-medium shadow-xs"
              aria-label="Nuevo chat"
              title="Iniciar nuevo chat"
            >
              <Icon name="plus" size={14} />
              <span className="hidden sm:inline">Nuevo chat</span>
            </button>

            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-semibold truncate text-ink-900 dark:text-white flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${
                    nativeModel
                      ? 'bg-black dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                      : 'bg-white/40'
                  }`}
                />
                {activeChatId
                  ? chats.find((c) => c.id === activeChatId)?.title ?? t('chat.newChat')
                  : t('chat.newChat')}
              </h2>
              {nativeModel ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenModels}
                    className="font-mono text-[10px] text-ink-500 dark:text-white/50 truncate tracking-wide hover:text-ink-900 dark:hover:text-white transition cursor-pointer text-left"
                    aria-label={t('header.changeModel')} title={t('header.changeModel')}
                  >
                    IA: {nativeModelLabel()}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoRouter
                      setAutoRouter(next)
                      haptic('selection')
                    }}
                    className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full font-bold border transition cursor-pointer flex items-center gap-1 ${
                      autoRouter
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10 text-ink-400 dark:text-white/40'
                    }`}
                    title={autoRouter ? "Router automático activo: selecciona el modelo y razonamiento ideal" : "Modo manual"}
                  >
                    <span>{autoRouter ? (routeDecision?.enableThinking ? 'AUTO · 🧠 THINK' : 'ROUTER AUTO') : 'MANUAL'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="font-mono text-[10px] text-ink-500 dark:text-white/40 truncate tracking-wide hover:text-ink-900 dark:hover:text-white transition cursor-pointer text-left"
                  aria-label="Elegir o descargar IA" title="Elegir o descargar IA"
                >
                  SIN IA · TOCA PARA ELEGIR
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="rounded-full text-xs px-3 py-1.5 gap-1.5 border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-ink-700 dark:text-white/80 hover:text-ink-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.07] active:scale-95 transition cursor-pointer flex items-center"
              aria-label="Abrir Biblioteca de Documentos" title="Abrir Biblioteca de Documentos"
            >
              <Icon name="library" size={14} />
              <span className="hidden sm:inline">Docs</span>
            </button>
            <button
              type="button"
              onClick={onOpenNotes}
              className="rounded-full text-xs px-3 py-1.5 gap-1.5 border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-ink-700 dark:text-white/80 hover:text-ink-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.07] active:scale-95 transition cursor-pointer flex items-center"
              aria-label="Abrir Notas Personales" title="Abrir Notas Personales"
            >
              <Icon name="copy" size={14} />
              <span className="hidden sm:inline">Notas</span>
            </button>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="icon-btn rounded-full active:scale-90"
                aria-label="Configuración y Modelos" title="Configuración y Modelos"
              >
                <Icon name="settings" size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className="icon-btn rounded-full active:scale-90"
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </header>

        {/* Lista de Mensajes */}
        <div
          onScroll={(e) => {
            const el = e.currentTarget
            isUserScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 140
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-4 scroll-thin"
        >
          {messages.length === 0 && !streamingContent ? (
            /* Estado Vacío / Pantalla de Bienvenida Estilo Sovereign Deck */
            <div className="relative flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-8 gap-5 animate-fade-up">
              {/* Sutil resplandor ambiental y malla neural */}
              <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden opacity-30">
                <div className="w-96 h-96 rounded-full bg-white/5 filter blur-3xl animate-breathe" />
              </div>

              {/* Núcleo Central Orbital */}
              <div className="relative flex items-center justify-center my-1 select-none">
                <div className="absolute size-28 rounded-full border border-dashed border-white/20 animate-spin-slow" />
                <div className="absolute size-36 rounded-full border border-white/[0.06]" />
                <div className="absolute size-44 rounded-full border border-dotted border-white/[0.09] animate-spin-reverse" />
                <div className="size-24 rounded-full bg-black/90 border border-white/30 flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.22)] backdrop-blur-md overflow-hidden">
                  <img
                    src="/logo-jinx.png"
                    width={72}
                    height={72}
                    alt="Jinx"
                    style={{ borderRadius: '50%' }}
                    className="select-none animate-glow rounded-full"
                    draggable={false}
                  />
                </div>
              </div>

              {/* Tag de Telemetría */}
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/[0.04] px-3.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-700 dark:text-white/70 shadow-xs">
                <span className="size-1.5 rounded-full bg-black dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                <span>Jinx OFFGRID // NATIVE COGNITION</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink-950 dark:text-white">
                  Inteligencia Soberana <span className="text-gradient-monochrome">100% Desconectada</span>
                </h3>
                <p className="text-xs sm:text-sm text-ink-500 dark:text-white/50 max-w-lg mx-auto">
                  Inferencia local privada (llama.cpp / WebLLM), visión multimodal offline, RAG con citas y control del dispositivo.
                </p>
              </div>

              {!nativeModel && (
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="btn-primary rounded-full px-6 py-3 text-sm cursor-pointer shadow-md active:scale-95"
                >
                  <Icon name="download" size={16} />
                  Descargar tu IA (una sola vez)
                </button>
              )}

              {/* 4 Tarjetas de capacidad real en Monocromo Frosted Glass */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left my-1 stagger">
                {/* Card 1: RAG */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenLibrary()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenLibrary()
                  }}
                  className="glass-card rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer group active:scale-[0.98] transition-all"
                >
                  <div className="size-10 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-white/30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.06)]">
                    <Icon name="library" size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-ink-950 dark:text-white group-hover:text-black dark:group-hover:text-white transition">
                      Documentos con Citas
                    </span>
                    <span className="text-[11px] text-ink-500 dark:text-white/50 leading-relaxed mt-0.5">
                      Sube PDFs y consulta con fuentes verificables [1], [2] por página.
                    </span>
                  </div>
                </div>

                {/* Card 2: Notas */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenNotes()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenNotes()
                  }}
                  className="glass-card rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer group active:scale-[0.98] transition-all"
                >
                  <div className="size-10 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-white/30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.06)]">
                    <Icon name="copy" size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-ink-950 dark:text-white group-hover:text-black dark:group-hover:text-white transition">
                      Notas Privadas
                    </span>
                    <span className="text-[11px] text-ink-500 dark:text-white/50 leading-relaxed mt-0.5">
                      Guarda apuntes en tu equipo y debate ideas con la IA.
                    </span>
                  </div>
                </div>

                {/* Card 3: Modelos */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenModels()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenModels()
                  }}
                  className="glass-card rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer group active:scale-[0.98] transition-all"
                >
                  <div className="size-10 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-white/30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.06)]">
                    <Icon name="cpu" size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-ink-950 dark:text-white group-hover:text-black dark:group-hover:text-white transition">
                      Modelos Offline
                    </span>
                    <span className="text-[11px] text-ink-500 dark:text-white/50 leading-relaxed mt-0.5">
                      Llama, Qwen o Gemma operando en CPU y WebGPU sin internet.
                    </span>
                  </div>
                </div>

                {/* Card 4: Agente */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleSend('Dime la hora y cuánta batería tiene el teléfono')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSend('Dime la hora y cuánta batería tiene el teléfono')
                  }}
                  className="glass-card rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer group active:scale-[0.98] transition-all"
                >
                  <div className="size-10 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-white/30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.06)]">
                    <Icon name="sparkles" size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-ink-950 dark:text-white group-hover:text-black dark:group-hover:text-white transition">
                      Agente del Sistema
                    </span>
                    <span className="text-[11px] text-ink-500 dark:text-white/50 leading-relaxed mt-0.5">
                      Ejecuta herramientas nativas: linterna, diagnósticos, archivos y más.
                    </span>
                  </div>
                </div>
              </div>

              {/* Consultas rápidas multimodales y tácticas */}
              <div className="w-full flex flex-col gap-2 mt-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-white/40 text-left px-1">
                  CONSULTAS RÁPIDAS Y MULTIMODAL:
                </span>
                {([
                  { text: 'Analizar foto o diagrama (adjunta o pega con Ctrl+V)', icon: 'image' },
                  { text: '¿Cuánta batería y recursos de hardware tiene el dispositivo?', icon: 'cpu' },
                  { text: 'Explícame la teoría de la relatividad en 3 puntos claros', icon: 'sparkles' },
                  { text: 'Dame 3 recomendaciones prácticas para optimizar autonomía', icon: 'library' },
                ] as const).map((sug) => (
                  <button
                    key={sug.text}
                    type="button"
                    onClick={() => void handleSend(sug.text)}
                    className="glass-card rounded-2xl px-4 py-3 min-h-[46px] text-xs text-left text-ink-700 dark:text-white/80 hover:text-ink-950 dark:hover:text-white transition flex items-center justify-between group cursor-pointer active:scale-[0.99] border border-black/10 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon name={sug.icon} size={15} className="text-ink-400 dark:text-white/40 shrink-0" />
                      <span className="truncate pr-2">{sug.text}</span>
                    </div>
                    <Icon
                      name="send"
                      size={13}
                      className="text-ink-400 dark:text-white/40 group-hover:text-black dark:group-hover:text-white group-hover:translate-x-0.5 transition shrink-0"
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
                  attachments={m.attachments}
                  stats={m.stats}
                  onOpenCode={onOpenCode}
                />
              ))}

              {/* Burbuja en streaming mientras la IA escribe */}
              {streamingContent !== null && (
                <MessageBubble
                  role="assistant"
                  content={streamingContent}
                  citations={streamingCitations}
                  streaming
                  stats={streamingStats ?? undefined}
                  onOpenCode={onOpenCode}
                />
              )}

              {/* Indicador en vivo de procesamiento sin tapar la pantalla */}
              {generating && !streamingContent && (
                <div className="flex items-center gap-3 py-2 px-3.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 w-fit backdrop-blur-md animate-fade-up">
                  <div className="relative flex items-center justify-center size-3">
                    <span className="size-3 rounded-full bg-black dark:bg-white animate-ping opacity-75" />
                    <span className="absolute size-2 rounded-full bg-black dark:bg-white" />
                  </div>
                  <span className="font-mono text-xs text-ink-800 dark:text-white/90">
                    {agentOn ? 'Agente coordinando herramientas…' : 'IA procesando respuesta…'}{' '}
                    <span className="text-ink-400 dark:text-white/40">{thinkingSeconds}s</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStop(true)}
                    className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-black/10 dark:bg-white/15 hover:bg-danger-500/20 hover:text-danger-400 text-ink-700 dark:text-white transition active:scale-95 cursor-pointer border border-black/10 dark:border-white/10"
                    title="Detener generación y liberar motor"
                  >
                    <Icon name="close" size={11} />
                    <span>Detener</span>
                  </button>
                </div>
              )}
            </>
          )}
          {/* Oferta opcional de respuesta avanzada en la nube si el router detectó consulta compleja */}
          {lastCloudOpportunity && !generating && (
            <div className="mx-auto max-w-lg w-full p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs flex items-center justify-between gap-3 animate-fade-up">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name="sparkles" size={16} className="text-purple-400 shrink-0" />
                <span className="truncate">Pregunta compleja detectada. ¿Deseas análisis profundo?</span>
              </div>
              <button
                type="button"
                disabled={cloudLoading}
                onClick={() => void handleCloudFallback(lastCloudOpportunity.query)}
                className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-semibold border border-purple-500/30 transition shrink-0 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Icon name="cloud" size={13} />
                <span>{cloudLoading ? 'Consultando…' : 'Respuesta avanzada (nube)'}</span>
              </button>
            </div>
          )}

          {/* Banner de error si falló la generación */}
          {chatError && (
            <div role="alert" className="mx-auto max-w-lg w-full rounded-2xl border border-danger-500/40 bg-danger-500/10 p-3.5 text-danger-300 text-xs sm:text-sm flex items-center justify-between gap-3 animate-fade-up">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name="alert" size={18} className="shrink-0 text-danger-400" />
                <span className="truncate">{chatError.message}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const retry = chatError.retryContent
                  setChatError(null)
                  void handleSend(retry)
                }}
                className="btn-ghost px-3 py-1.5 text-xs text-danger-300 hover:text-white border border-danger-500/30 rounded-lg shrink-0 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Entrada de Mensajes */}
        <div className="p-4 sm:p-6 pt-0 safe-bottom">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {/* Mensajes en cola */}
            {messageQueue.length > 0 && (
              <div className="flex items-center justify-between px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/[0.08] border border-black/10 dark:border-white/15 text-xs text-ink-700 dark:text-white/80 animate-fade-up">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="truncate font-mono text-[11px]">
                    {messageQueue.length} mensaje{messageQueue.length > 1 ? 's' : ''} en cola: &quot;{messageQueue[0]?.content.slice(0, 36) ?? ''}...&quot;
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMessageQueue([])}
                  className="font-mono text-[10px] text-danger-400 hover:text-danger-300 ml-2 cursor-pointer transition shrink-0"
                >
                  Descartar cola
                </button>
              </div>
            )}

            {canRegenerate && (
              <div className="flex justify-end px-1">
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-400 hover:text-signal-300 transition cursor-pointer"
                  aria-label="Reintentar respuesta" title="Reintentar respuesta"
                >
                  <Icon name="refresh" size={13} />
                  Reintentar
                </button>
              </div>
            )}
            {dictNotice && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-300 animate-fade-up flex items-center gap-2">
                {dictating && (
                  <span className="eq" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                <span>{dictNotice}</span>
              </div>
            )}
            {dictating && !dictNotice && (
              <div className="flex items-center gap-2 px-1">
                <span className="eq" aria-label="Escuchando">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="font-mono text-[11px] text-cyan-300">Escuchando… habla ahora</span>
              </div>
            )}
            {/* Deck de archivos e imágenes adjuntas pendientes */}
            {pendingAttachments.length > 0 && (
              <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-neutral-100/95 dark:bg-neutral-900/95 backdrop-blur-2xl p-3 shadow-xl animate-fade-up flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Archivos adjuntos ({pendingAttachments.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingAttachments([])}
                    className="text-[11px] font-mono text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Quitar todos
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto p-0.5">
                  {pendingAttachments.map((att) => {
                    const isImg = att.type === 'image' && att.dataUrl
                    const ext = att.name.split('.').pop()?.toUpperCase() || 'FILE'
                    return (
                      <div
                        key={att.id}
                        className="group relative flex items-center gap-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-black/60 p-2 pr-3 shadow-xs hover:border-black/25 dark:hover:border-white/30 transition max-w-full sm:max-w-[280px]"
                      >
                        {/* Miniatura visual de imagen o icono de archivo */}
                        {isImg ? (
                          <div
                            onClick={() => setPreviewAttachment(att)}
                            className="relative size-11 rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/20 cursor-pointer bg-neutral-200 dark:bg-neutral-800 group-hover:scale-105 transition shadow-xs"
                            title="Haz clic para ver imagen completa"
                          >
                            <img src={att.dataUrl} alt={att.name} className="size-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                              <Icon name="eye" size={13} />
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setPreviewAttachment(att)}
                            className="size-11 rounded-lg border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 font-mono font-bold text-[11px] text-neutral-800 dark:text-neutral-200 cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 transition shadow-xs"
                            title="Haz clic para previsualizar texto"
                          >
                            {ext.length <= 4 ? ext : <Icon name="fileText" size={16} />}
                          </div>
                        )}

                        {/* Detalles del archivo */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate" title={att.name}>
                            {att.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                            <span>{(att.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {att.type === 'image' ? 'Visión lista' : 'Texto listo'}
                            </span>
                          </div>
                        </div>

                        {/* Botón eliminar adjunto */}
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-1 rounded-full text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                          title={`Eliminar ${att.name}`}
                          aria-label={`Eliminar ${att.name}`}
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Indicador de procesamiento activo */}
            {processingFiles && (
              <div className="rounded-xl border border-black/10 dark:border-white/15 bg-neutral-100 dark:bg-neutral-900 p-2.5 flex items-center gap-3 text-xs text-neutral-800 dark:text-neutral-200 animate-pulse shadow-sm">
                <span className="size-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="font-mono text-[11px]">
                  Procesando archivos: Extrayendo texto y analizando visión multimodal offline...
                </span>
              </div>
            )}

            <div className="command-bar rounded-[26px] p-2 sm:p-2.5 flex items-end gap-1.5 sm:gap-2 transition-all duration-200 border border-black/10 dark:border-white/15 bg-white/80 dark:bg-black/75 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]">
              {/* Botón Directo 1: Subir Foto / Imagen */}
              <button
                type="button"
                onClick={() => {
                  if (imageInputRef.current) imageInputRef.current.value = ''
                  imageInputRef.current?.click()
                }}
                disabled={processingFiles || generating}
                className="relative min-h-[42px] min-w-[42px] p-2.5 rounded-full shrink-0 cursor-pointer transition flex items-center justify-center text-ink-500 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] active:scale-95 disabled:opacity-40"
                aria-label="Adjuntar foto o imagen para análisis"
                title="Adjuntar foto o imagen (análisis visual y OCR)"
              >
                <Icon name="image" size={18} />
                {pendingAttachments.some((a) => a.type === 'image') && (
                  <span className="absolute top-1 right-1 size-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                )}
              </button>

              {/* Botón Directo 2: Subir Documento / Archivo */}
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = ''
                  fileInputRef.current?.click()
                }}
                disabled={processingFiles || generating}
                className="relative min-h-[42px] min-w-[42px] p-2.5 rounded-full shrink-0 cursor-pointer transition flex items-center justify-center text-ink-500 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] active:scale-95 disabled:opacity-40"
                aria-label="Adjuntar documento o archivo"
                title="Adjuntar documento o archivo (PDF, DOCX, TXT, Código...)"
              >
                <Icon name="paperclip" size={18} className={processingFiles ? 'animate-spin' : ''} />
                {pendingAttachments.some((a) => a.type !== 'image') && (
                  <span className="absolute top-1 right-1 size-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.9)]" />
                )}
              </button>

              {/* Input oculto para imágenes */}
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) void handleFilesSelected(files)
                }}
              />

              {/* Input oculto para documentos y código */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,.markdown,.json,.csv,.tsv,.py,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.log,*/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) void handleFilesSelected(files)
                }}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                enterKeyHint="send"
                autoCapitalize="sentences"
                spellCheck
                rows={1}
                aria-label="Entrada de mensaje"
                placeholder={
                  nativeModel
                    ? agentOn
                      ? 'Pide una acción al agente (o adjunta un archivo)…'
                      : pendingAttachments.length > 0
                        ? 'Pregunta sobre los archivos adjuntos…'
                        : 'Escribe un mensaje o pega una imagen…'
                    : 'Selecciona un modelo en Modelos…'
                }
                disabled={!nativeModel}
                className="flex-1 bg-transparent px-2 py-1.5 text-sm sm:text-base resize-none focus:outline-none placeholder:text-ink-400 dark:placeholder:text-white/35 max-h-44 scroll-thin text-ink-950 dark:text-white"
              />

              <button
                type="button"
                onClick={toggleDictation}
                className={`min-h-[42px] min-w-[42px] p-2.5 rounded-full shrink-0 cursor-pointer transition flex items-center justify-center active:scale-95 ${
                  dictating
                    ? 'bg-black/10 dark:bg-white/20 text-black dark:text-white'
                    : 'text-ink-500 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08]'
                }`}
                aria-label={dictating ? 'Detener dictado' : 'Dictar por voz'}
                title={dictating ? 'Detener dictado' : 'Dictar por voz'}
              >
                <Icon name="mic" size={18} className={dictating ? 'animate-pulse' : ''} />
              </button>

              {isGenerating && (
                <button
                  type="button"
                  onClick={() => handleStop(true)}
                  className="min-h-[42px] min-w-[42px] rounded-full bg-danger-500/20 text-danger-400 hover:bg-danger-500/30 p-2.5 transition shrink-0 cursor-pointer shadow-[0_0_12px_rgba(201,106,94,0.3)] flex items-center justify-center active:scale-95"
                  aria-label={t('chat.stop')}
                  title={t('chat.stop')}
                >
                  <Icon name="stop" size={18} />
                </button>
              )}

              {(!isGenerating || input.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={(!input.trim() && pendingAttachments.length === 0) || !nativeModel}
                  className={`min-h-[42px] min-w-[42px] p-2.5 rounded-full shrink-0 cursor-pointer flex items-center justify-center active:scale-95 shadow-md ${
                    isGenerating
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                      : 'btn-primary'
                  }`}
                  aria-label={isGenerating ? 'Encolar mensaje' : t('chat.send')}
                  title={isGenerating ? 'Encolar mensaje' : t('chat.send')}
                >
                  <Icon name={isGenerating ? 'refresh' : 'send'} size={18} />
                </button>
              )}
            </div>

            {/* Estado del motor + modo agente + router + ayuda de teclado */}
            <div className="flex items-center justify-between px-1 gap-2 pt-0.5">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-mono text-[11px] font-semibold tracking-wider uppercase transition cursor-pointer bg-black/5 dark:bg-white/[0.06] text-ink-800 dark:text-white/85 border border-black/10 dark:border-white/15 hover:border-black/25 dark:hover:border-white/30 active:scale-95 shrink-0"
                  aria-label="Abrir Modelos de IA"
                  title="Abrir Modelos de IA"
                >
                  <span className="size-1.5 rounded-full bg-black dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                  <span className="truncate">{nativeModel ? `IA · ${nativeModelLabel()}` : 'SIN IA'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAgentOn((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-mono text-[11px] font-semibold tracking-wider uppercase transition cursor-pointer shrink-0 border active:scale-95 ${
                    agentOn
                      ? 'bg-black/10 dark:bg-white/[0.14] text-black dark:text-white border-black/20 dark:border-white/30 shadow-xs'
                      : 'bg-black/[0.03] dark:bg-white/[0.03] text-ink-500 dark:text-white/40 border-black/10 dark:border-white/10 hover:text-black dark:hover:text-white'
                  }`}
                  aria-label="Activar modo agente"
                  title="El modelo puede usar linterna, ubicación, temporizador y más"
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      agentOn ? 'bg-black dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'bg-ink-400 dark:bg-white/30'
                    }`}
                  />
                  <span>AGENTE {agentOn ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoRouter((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold tracking-wider uppercase transition cursor-pointer shrink-0 border active:scale-95 ${
                    autoRouter
                      ? 'bg-black/10 dark:bg-white/[0.14] text-black dark:text-white border-black/20 dark:border-white/30'
                      : 'bg-black/[0.03] dark:bg-white/[0.03] text-ink-500 dark:text-white/40 border-black/10 dark:border-white/10'
                  }`}
                  aria-label="Router de modelos"
                  title="Router automático (270M simple / 4B razonamiento)"
                >
                  <Icon name="sparkles" size={12} />
                  <span>ROUTER {autoRouter ? 'AUTO' : 'OFF'}</span>
                </button>
              </div>

              <span className="font-mono text-[10px] text-ink-400 dark:text-white/40 hidden sm:block tracking-wide">
                ↵ Enviar · Shift + ↵ Salto de línea
              </span>
            </div>
          </div>
        </div>

        {/* Modal / Lightbox de previsualización de archivos adjuntos */}
        {previewAttachment && (
          <div
            role="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md cursor-pointer animate-fade-in"
            onClick={() => setPreviewAttachment(null)}
          >
            <div
              className="max-w-2xl w-full rounded-3xl border border-black/20 dark:border-white/20 bg-white dark:bg-neutral-950 p-5 text-neutral-900 dark:text-white shadow-2xl flex flex-col gap-3.5 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                <div className="min-w-0 pr-3">
                  <h4 className="text-sm font-semibold truncate text-neutral-900 dark:text-white">{previewAttachment.name}</h4>
                  <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    {(previewAttachment.size / 1024).toFixed(1)} KB • {previewAttachment.mimeType}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-neutral-700 dark:text-white transition cursor-pointer"
                  title="Cerrar vista previa"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              {previewAttachment.type === 'image' && previewAttachment.dataUrl && (
                <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[60vh] border border-black/10 dark:border-white/10 shadow-inner">
                  <img
                    src={previewAttachment.dataUrl}
                    alt={previewAttachment.name}
                    className="max-h-[58vh] max-w-full object-contain"
                  />
                </div>
              )}

              {previewAttachment.visionAnalysis && (
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-neutral-700 dark:text-neutral-300 font-mono space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {previewAttachment.visionAnalysis.category}
                    </span>
                    <span>
                      {previewAttachment.visionAnalysis.width}×{previewAttachment.visionAnalysis.height} ({previewAttachment.visionAnalysis.aspectRatio})
                    </span>
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {previewAttachment.visionAnalysis.summary}
                  </div>
                  {previewAttachment.visionAnalysis.detectedText && (
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Texto detectado: "{previewAttachment.visionAnalysis.detectedText}"
                    </div>
                  )}
                </div>
              )}

              {previewAttachment.type !== 'image' && previewAttachment.textContent && (
                <div className="max-h-[50vh] overflow-y-auto p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed select-text">
                  {previewAttachment.textContent.slice(0, 4000)}
                  {previewAttachment.textContent.length > 4000 ? '\n\n... (extracto truncado para vista previa)' : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
