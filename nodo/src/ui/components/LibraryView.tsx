import { useEffect, useRef, useState } from 'react'
import type { DocumentRecord } from '../../types'
import {
  listDocuments,
  deleteDocument,
  ingestDocument,
  type IngestProgress,
} from '../../core/rag/ingest'
import { summarizeDocument, type SummarizeProgress } from '../../core/rag/summarize'
import { formatBytes } from '../../core/offline/storage'
import { isEmergencyPackInstalled, installEmergencyPack } from '../../core/rag/emergencyPack'
import { Icon } from './Icon'
import { ProgressBar } from './ProgressBar'

interface LibraryViewProps {
  onBack: () => void
  onAskDoc?: (docName: string) => void
}

export function LibraryView({ onBack, onAskDoc }: LibraryViewProps) {
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [docQuery, setDocQuery] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestStatus, setIngestStatus] = useState<IngestProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Paquete de emergencia
  const [emergencyInstalled, setEmergencyInstalled] = useState(false)
  const [installingEmergency, setInstallingEmergency] = useState(false)
  const [emergencyProgressText, setEmergencyProgressText] = useState('')

  // Resumen modal
  const [summarizingDoc, setSummarizingDoc] = useState<DocumentRecord | null>(null)
  const [summaryProgress, setSummaryProgress] = useState<SummarizeProgress | null>(null)
  const [summaryResult, setSummaryResult] = useState<string | null>(null)
  const [summaryCopied, setSummaryCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const filteredDocs = docQuery.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(docQuery.trim().toLowerCase()))
    : docs

  const refresh = async () => {
    try {
      const [list, isInstalled] = await Promise.all([
        listDocuments(),
        isEmergencyPackInstalled(),
      ])
      setDocs(list)
      setEmergencyInstalled(isInstalled)
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleInstallEmergency = async () => {
    setInstallingEmergency(true)
    setError(null)
    try {
      await installEmergencyPack((fileName, p) => {
        setEmergencyProgressText(`${fileName}: ${p.text}`)
      })
      setEmergencyInstalled(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInstallingEmergency(false)
      setEmergencyProgressText('')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError(null)
    setIngesting(true)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        await ingestDocument(file, (p) => setIngestStatus(p))
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIngesting(false)
      setIngestStatus(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Deseas eliminar este documento y sus fragmentos indexados?')) return
    await deleteDocument(id)
    await refresh()
  }

  const handleStartSummary = async (doc: DocumentRecord) => {
    setSummarizingDoc(doc)
    setSummaryResult(null)
    setSummaryProgress(null)
    setError(null)

    try {
      const text = await summarizeDocument(doc.id, (p) => setSummaryProgress(p))
      setSummaryResult(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSummarizingDoc(null)
    }
  }

  const handleCopySummary = async () => {
    if (!summaryResult) return
    await navigator.clipboard.writeText(summaryResult)
    setSummaryCopied(true)
    setTimeout(() => setSummaryCopied(false), 2000)
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-10 app-backdrop select-none overflow-y-auto">
      {/* Botón Volver */}
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-6 btn-ghost gap-1.5 text-xs sm:text-sm cursor-pointer"
      >
        <Icon name="close" size={16} />
        Volver al Chat
      </button>

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/60 dark:border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-lg shadow-signal-500/20">
              <Icon name="library" size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">
                Biblioteca de Documentos
              </h1>
              <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400">
                Indexa PDFs, DOCX, TXT o MD para consultar con IA 100% offline y citas exactas
              </p>
            </div>
          </div>

          {/* Botón Subir */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              disabled={ingesting}
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary w-full sm:w-auto px-5 py-2.5 text-sm gap-2 cursor-pointer disabled:opacity-50"
            >
              <Icon name="upload" size={16} />
              {ingesting ? 'Indexando...' : 'Subir Documento'}
            </button>
          </div>
        </div>

        {/* Banner / Tarjeta de Paquete de Emergencia */}
        <div className="glass-card rounded-2xl border-ember-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-linear-to-r from-ember-500/10 via-white/[0.02] to-transparent shadow-[0_0_25px_-5px_rgba(255,184,0,0.15)]">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-xl bg-ember-500/15 border border-ember-500/30 text-ember-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(255,184,0,0.25)]">
              <Icon name="shield" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Paquete de Supervivencia y Emergencias</span>
                  <span className="font-mono text-[9px] text-ember-400 border border-ember-500/30 bg-ember-500/10 px-1.5 py-0.5 rounded uppercase">
                    OFFGRID PACK
                  </span>
                </h4>
                {emergencyInstalled && (
                  <span className="font-mono text-[10px] font-bold bg-signal-500/20 text-signal-400 border border-signal-500/30 px-2 py-0.5 rounded-full">
                    INSTALADO
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-300 mt-0.5">
                Guías médicas offline: primeros auxilios (RCP/PAS), purificación de agua y protocolos de rescate.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {emergencyInstalled ? (
              <span className="font-mono text-xs text-signal-400 flex items-center gap-1.5 font-semibold">
                <span className="size-2 rounded-full bg-signal-400 shadow-[0_0_6px_#00f5a0]" />
                DISPONIBLE EN BASE LOCAL
              </span>
            ) : (
              <button
                type="button"
                disabled={installingEmergency}
                onClick={handleInstallEmergency}
                className="btn-amber text-xs px-4 py-2.5 gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Icon
                  name={installingEmergency ? 'refresh' : 'download'}
                  size={14}
                  className={installingEmergency ? 'animate-spin' : ''}
                />
                {installingEmergency ? 'Instalando...' : 'Instalar con 1 Clic'}
              </button>
            )}
          </div>
        </div>

        {/* Progreso instalación de emergencia */}
        {installingEmergency && emergencyProgressText && (
          <div className="text-xs text-signal-400 flex items-center gap-2 animate-pulse px-2">
            <Icon name="refresh" size={13} className="animate-spin" />
            <span>{emergencyProgressText}</span>
          </div>
        )}

        {/* Notificación de Error */}
        {error && (
          <div className="glass rounded-2xl border-ember-500/30 bg-ember-500/10 p-4 text-ember-600 dark:text-ember-300 flex items-start gap-3 animate-fade-up">
            <Icon name="alert" size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="font-semibold block">Ocurrió un problema</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Progreso de Ingesta */}
        {ingesting && ingestStatus && (
          <div className="glass rounded-2xl border-signal-500/30 p-5 flex flex-col gap-3 shadow-xl animate-fade-up">
            <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
              <span className="flex items-center gap-2 text-signal-400">
                <Icon name="refresh" size={16} className="animate-spin" />
                {ingestStatus.text}
              </span>
              {ingestStatus.total ? (
                <span className="text-ink-400">
                  {Math.round(((ingestStatus.current ?? 0) / ingestStatus.total) * 100)}%
                </span>
              ) : null}
            </div>
            {ingestStatus.total ? (
              <ProgressBar
                value={(ingestStatus.current ?? 0) / ingestStatus.total}
              />
            ) : null}
          </div>
        )}

        {/* Zona de Arrastrar si no hay documentos */}
        {docs.length === 0 && !loadingDocs && !ingesting && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-ink-300/60 dark:border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-signal-500/50 hover:bg-signal-500/[0.02] transition"
          >
            <div className="size-16 rounded-2xl bg-ink-200/50 dark:bg-white/5 flex items-center justify-center text-ink-400">
              <Icon name="fileText" size={32} />
            </div>
            <h3 className="font-semibold text-base text-ink-800 dark:text-ink-100">
              No tienes documentos indexados todavía
            </h3>
            <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400 max-w-sm">
              Sube tus apuntes, manuales o libros en formato PDF, DOCX, TXT o Markdown para hacerles preguntas con citas
            </p>
          </div>
        )}

        {/* Lista de Documentos */}
        {docs.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Documentos Indexados ({docs.length})
              </span>
              <input
                type="search"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                aria-label="Filtrar documentos" placeholder="Filtrar..."
                className="rounded-lg border border-ink-200/70 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] py-1.5 px-3 text-xs text-ink-900 dark:text-white focus:border-signal-500 focus:outline-none w-40"
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-signal-500/40"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-10 rounded-xl bg-signal-500/15 border border-signal-500/30 text-signal-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_-2px_rgba(0,245,160,0.25)]">
                      <Icon name="fileText" size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm sm:text-base text-white truncate">
                        {doc.name}
                      </h4>
                      <div className="flex items-center gap-2.5 font-mono text-[11px] text-ink-400 mt-0.5">
                        <span className="text-signal-400">{doc.pages} {doc.pages === 1 ? 'pág' : 'págs'}</span>
                        <span>•</span>
                        <span>{formatBytes(doc.size)}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {onAskDoc && (
                      <button
                        type="button"
                        onClick={() => onAskDoc(doc.name)}
                        className="btn-ghost text-xs px-3 py-1.5 gap-1.5 text-signal-400 hover:text-signal-300 hover:bg-signal-500/10 cursor-pointer rounded-lg border border-signal-500/30"
                        aria-label="Preguntar sobre este documento" title="Preguntar sobre este documento"
                      >
                        <Icon name="message" size={14} />
                        Preguntar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartSummary(doc)}
                      className="btn-ghost text-xs px-3 py-1.5 gap-1.5 cursor-pointer rounded-lg border border-white/10 hover:border-white/20"
                      aria-label="Generar resumen completo Map-Reduce" title="Generar resumen completo Map-Reduce"
                    >
                      <Icon name="sparkles" size={14} />
                      Resumir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 rounded-xl text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 transition cursor-pointer"
                      aria-label="Eliminar documento" title="Eliminar documento"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {filteredDocs.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-4">Sin resultados para "{docQuery}"</p>
            )}
          </div>
        )}
      </div>

      {/* Modal de Resumen Map-Reduce */}
      {summarizingDoc && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/70 p-0 sm:p-4 backdrop-blur-xs cursor-pointer animate-fade-in"
          onClick={() => setSummarizingDoc(null)}
        >
          <div
            className="glass max-w-2xl w-full rounded-t-3xl sm:rounded-3xl border border-signal-500/30 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl flex flex-col gap-4 animate-sheet-up sm:animate-pop-in text-ink-900 dark:text-ink-100 max-h-[85vh] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto mb-1 h-1 w-10 rounded-full bg-ink-400/30 sm:hidden" />
            <div className="flex items-center justify-between border-b border-ink-200/60 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-signal-500/20 text-signal-400 flex items-center justify-center">
                  <Icon name="sparkles" size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base">Resumen Inteligente</h3>
                  <p className="text-xs text-ink-400 truncate max-w-xs">{summarizingDoc.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummarizingDoc(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-white/10 cursor-pointer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Progreso mientras resume */}
            {!summaryResult && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <Icon name="refresh" size={28} className="animate-spin text-signal-400" />
                <span className="text-sm font-medium text-ink-700 dark:text-ink-200">
                  {summaryProgress?.text ?? 'Iniciando análisis Map-Reduce...'}
                </span>
                {summaryProgress?.totalBatches ? (
                  <span className="text-xs text-ink-400">
                    Lote {summaryProgress.currentBatch} de {summaryProgress.totalBatches}
                  </span>
                ) : null}
              </div>
            )}

            {/* Contenido del Resumen */}
            {summaryResult && (
              <>
                <div className="overflow-y-auto rounded-2xl bg-ink-100/50 dark:bg-white/[0.03] p-4 text-xs sm:text-sm leading-relaxed text-ink-800 dark:text-ink-200 whitespace-pre-wrap max-h-96">
                  {summaryResult}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="btn-ghost text-xs gap-1.5 cursor-pointer"
                  >
                    <Icon name={summaryCopied ? 'check' : 'copy'} size={14} />
                    {summaryCopied ? '¡Copiado!' : 'Copiar Resumen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummarizingDoc(null)}
                    className="btn-primary text-xs px-5 py-2 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
