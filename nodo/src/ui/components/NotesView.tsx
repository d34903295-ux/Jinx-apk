import { useEffect, useState } from 'react'
import type { NoteRecord } from '../../types'
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
} from '../../core/db/repo'
import { Icon } from './Icon'
import { nativeAction } from '../../core/native/bridge'
import { downloadPdf } from '../../core/document/pdfGenerator'

interface NotesViewProps {
  onBack: () => void
  onSendToChat?: (text: string) => void
}

export function NotesView({ onBack, onSendToChat }: NotesViewProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeNote, setActiveNote] = useState<NoteRecord | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const refreshNotes = async (query = searchQuery) => {
    if (query.trim()) {
      const results = await searchNotes(query)
      setNotes(results)
    } else {
      const all = await listNotes()
      setNotes(all)
    }
  }

  useEffect(() => {
    let alive = true
    listNotes().then((all) => {
      if (alive) setNotes(all)
    })
    return () => {
      alive = false
    }
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setSearchQuery(q)
    void refreshNotes(q)
  }

  const handleCreateNew = () => {
    setActiveNote(null)
    setEditTitle('')
    setEditBody('')
    setIsEditing(true)
  }

  const handleSelectNote = (note: NoteRecord) => {
    setActiveNote(note)
    setEditTitle(note.title)
    setEditBody(note.body)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!editTitle.trim() && !editBody.trim()) return
    const title = editTitle.trim() || 'Nota sin título'
    const body = editBody.trim()

    let savedId: number
    if (activeNote) {
      await updateNote(activeNote.id, title, body)
      savedId = activeNote.id
    } else {
      savedId = await createNote(title, body)
    }

    setIsEditing(false)
    await refreshNotes()
    const updated = await listNotes()
    const found = updated.find((n) => n.id === savedId)
    setActiveNote(found ?? updated[0] ?? null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Deseas eliminar esta nota?')) return
    await deleteNote(id)
    if (activeNote?.id === id) {
      setActiveNote(null)
      setIsEditing(false)
    }
    await refreshNotes()
  }

  const handleCopy = async (note: NoteRecord) => {
    await navigator.clipboard.writeText(`${note.title}\n\n${note.body}`)
    setCopiedId(note.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleShare = async (note: NoteRecord) => {
    const text = `${note.title}\n\n${note.body}`
    const done = nativeAction((n) => n.shareText(note.title, text))
    if (done !== 'ok') {
      await handleCopy(note)
    }
  }

  const handleExportPdf = (note: NoteRecord) => {
    setIsExportingPdf(true)
    try {
      downloadPdf(
        {
          title: note.title,
          subtitle: 'Nota exportada desde Jinx AI',
          author: 'Jinx Notes',
          date: new Date(note.updatedAt).toLocaleDateString('es-ES'),
          sections: [
            {
              text: note.body,
            },
          ],
        },
        `${note.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30) || 'nota'}.pdf`
      )
    } finally {
      setTimeout(() => setIsExportingPdf(false), 1200)
    }
  }

  const handleExportMd = (note: NoteRecord) => {
    const mdContent = `# ${note.title}\n\n*Nota guardada en Jinx AI — ${new Date(note.updatedAt).toLocaleString('es-ES')}*\n\n${note.body}\n`
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = `${note.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30) || 'nota'}.md`
    a.download = safeName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <div className="relative h-full w-full flex flex-col p-4 pb-20 sm:p-6 lg:p-10 app-backdrop select-none overflow-hidden">
      {/* Botón Volver */}
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-4 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3.5 py-1.5 gap-1.5 text-xs sm:text-sm text-ink-700 dark:text-white/80 hover:text-ink-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] active:scale-95 transition cursor-pointer flex items-center"
        aria-label="Volver al Chat"
        title="Volver al Chat"
      >
        <Icon name="close" size={15} />
        Volver al Chat
      </button>

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/60 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 flex items-center justify-center text-ink-950 dark:text-white shadow-[0_0_20px_rgba(255,255,255,0.12)] backdrop-blur-xl shrink-0">
              <Icon name="copy" size={19} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
                Notas Personales
              </h1>
              <p className="text-xs sm:text-sm text-ink-500 dark:text-white/50">
                Guarda ideas, apuntes y respuestas de la IA 100% en tu dispositivo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateNew}
            className="btn-primary rounded-full px-5 py-2.5 text-xs sm:text-sm gap-2 cursor-pointer self-start sm:self-auto active:scale-95"
          >
            <Icon name="plus" size={16} />
            Nueva Nota
          </button>
        </div>

        {/* Contenido Principal: Lista + Detalle */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-[500px]">
          {/* Panel Izquierdo: Buscador y Lista de Notas */}
          <div className="md:col-span-5 flex flex-col gap-3 overflow-hidden glass-card rounded-3xl p-3 sm:p-4 border border-black/10 dark:border-white/10">
            {/* Buscador */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                aria-label="Buscar en notas"
                placeholder="Buscar en tus notas..."
                className="w-full rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/[0.04] py-2.5 pl-9 pr-4 text-xs sm:text-sm text-ink-950 dark:text-white placeholder:text-ink-400 focus:border-black/30 dark:focus:border-white/40 focus:outline-none focus:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition"
              />
              <span className="absolute left-3 top-3 text-ink-400">
                <Icon name="search" size={14} />
              </span>
            </div>

            {/* Listado */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 scroll-thin">
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-ink-400 gap-2">
                  <Icon name="fileText" size={28} />
                  <span className="text-xs">No hay notas que coincidan</span>
                </div>
              ) : (
                notes.map((n) => {
                  const isSelected = activeNote?.id === n.id
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleSelectNote(n)}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-150 flex flex-col gap-1 border text-left active:scale-[0.98] ${
                        isSelected
                          ? 'border-black/20 dark:border-white/30 bg-black/5 dark:bg-white/[0.09] text-ink-900 dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(255,255,255,0.08)]'
                          : 'border-transparent hover:border-black/10 dark:hover:border-white/15 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-ink-700 dark:text-ink-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm truncate text-ink-900 dark:text-white">{n.title}</h4>
                        <span className="font-mono text-[10px] text-ink-400 shrink-0">
                          {new Date(n.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-500 dark:text-white/50 line-clamp-2">
                        {n.body || '(Nota vacía)'}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Panel Derecho: Editor / Vista Detallada */}
          <div className="md:col-span-7 flex flex-col glass-card rounded-3xl p-5 sm:p-6 overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl">
            {isEditing || (!activeNote && notes.length === 0) ? (
              /* Modo Editor */
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-ink-200/60 dark:border-white/10 pb-3">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/60">
                    {activeNote ? 'Editando Nota' : 'Nueva Nota'}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeNote && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="btn-ghost rounded-full text-xs px-3.5 py-1.5 cursor-pointer active:scale-95"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn-primary rounded-full text-xs px-5 py-1.5 cursor-pointer active:scale-95"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  aria-label="Título de la nota"
                  placeholder="Título de la nota..."
                  className="w-full text-base sm:text-lg font-bold bg-transparent border-b border-black/10 dark:border-white/10 py-2.5 focus:outline-none focus:border-black/30 dark:focus:border-white/40 text-ink-950 dark:text-white"
                />

                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  aria-label="Contenido de la nota"
                  placeholder="Escribe el contenido de tu nota aquí..."
                  className="flex-1 w-full bg-transparent resize-none py-2 text-sm sm:text-base leading-relaxed focus:outline-none scroll-thin text-ink-900 dark:text-white/90"
                />
              </div>
            ) : activeNote ? (
              /* Modo Lectura */
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between border-b border-ink-200/60 dark:border-white/10 pb-3 gap-2">
                  <span className="font-mono text-[11px] text-ink-400 dark:text-white/40">
                    {new Date(activeNote.updatedAt).toLocaleString()}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {onSendToChat && (
                      <button
                        type="button"
                        onClick={() => onSendToChat(`Sobre mi nota "${activeNote.title}": ${activeNote.body}`)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 text-ink-950 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition cursor-pointer"
                        aria-label="Preguntar a la IA sobre esta nota"
                        title="Preguntar a la IA sobre esta nota"
                      >
                        <Icon name="sparkles" size={13} />
                        Consultar IA
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(activeNote)}
                      className="btn-ghost rounded-full text-xs px-2.5 py-1 gap-1 cursor-pointer active:scale-95"
                      title="Copiar nota"
                    >
                      <Icon name={copiedId === activeNote.id ? 'check' : 'copy'} size={13} />
                      {copiedId === activeNote.id ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare(activeNote)}
                      className="btn-ghost rounded-full text-xs px-2.5 py-1 gap-1 cursor-pointer active:scale-95"
                      aria-label="Compartir nota"
                      title="Compartir nota"
                    >
                      <Icon name="share" size={13} />
                      Compartir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPdf(activeNote)}
                      disabled={isExportingPdf}
                      className="btn-ghost rounded-full text-xs px-2.5 py-1 gap-1 cursor-pointer active:scale-95 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                      aria-label="Exportar a PDF"
                      title="Exportar esta nota a documento PDF profesional"
                    >
                      <Icon name="fileText" size={13} />
                      {isExportingPdf ? 'Exportando…' : 'PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportMd(activeNote)}
                      className="btn-ghost rounded-full text-xs px-2.5 py-1 gap-1 cursor-pointer active:scale-95 text-cyan-600 dark:text-cyan-400 hover:text-cyan-500"
                      aria-label="Exportar a Markdown"
                      title="Exportar esta nota como archivo .md"
                    >
                      <Icon name="edit" size={13} />
                      .MD
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="btn-ghost rounded-full text-xs px-3 py-1 gap-1 cursor-pointer active:scale-95"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(activeNote.id)}
                      className="p-1.5 rounded-full text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 active:scale-95 transition cursor-pointer"
                      aria-label="Eliminar"
                      title="Eliminar"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-b border-ink-100 dark:border-white/5 pb-2">
                  <h2 className="text-lg sm:text-xl font-bold text-ink-900 dark:text-white">
                    {activeNote.title}
                  </h2>
                  <span className="font-mono text-[10px] text-ink-400 dark:text-white/40 shrink-0">
                    {activeNote.body ? activeNote.body.trim().split(/\s+/).filter(Boolean).length : 0} palabras · {activeNote.body.length} caracteres
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-ink-700 dark:text-ink-200 scroll-thin pt-2">
                  {activeNote.body}
                </div>
              </div>
            ) : (
              /* Sin nota seleccionada */
              <div className="flex-1 flex flex-col items-center justify-center text-center text-ink-400 gap-3">
                <Icon name="copy" size={36} />
                <p className="text-sm">Selecciona una nota para leerla o crea una nueva</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
