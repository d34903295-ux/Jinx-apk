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
    void refreshNotes()
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

    if (activeNote) {
      await updateNote(activeNote.id, title, body)
    } else {
      await createNote(title, body)
    }

    setIsEditing(false)
    await refreshNotes()
    const updated = await listNotes()
    if (updated.length > 0) {
      setActiveNote(updated[0] ?? null)
    }
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

  return (
    <div className="relative min-h-screen w-full flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-10 app-backdrop select-none overflow-hidden">
      {/* Botón Volver */}
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-4 btn-ghost gap-1.5 text-xs sm:text-sm cursor-pointer"
      >
        <Icon name="close" size={16} />
        Volver al Chat
      </button>

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/60 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-md shadow-signal-500/20">
              <Icon name="copy" size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">
                Notas Personales
              </h1>
              <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400">
                Guarda ideas, apuntes y respuestas de la IA 100% en tu dispositivo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateNew}
            className="btn-primary px-4 py-2 text-xs sm:text-sm gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Icon name="plus" size={16} />
            Nueva Nota
          </button>
        </div>

        {/* Contenido Principal: Lista + Detalle */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-[500px]">
          {/* Panel Izquierdo: Buscador y Lista de Notas */}
          <div className="md:col-span-5 flex flex-col gap-3 overflow-hidden glass-card rounded-3xl p-3 sm:p-4 border border-white/10">
            {/* Buscador */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscar en tus notas..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-xs sm:text-sm text-white focus:border-signal-500 focus:outline-none focus:shadow-[0_0_15px_rgba(0,245,160,0.2)] transition"
              />
              <span className="absolute left-2.5 top-2.5 text-ink-400">
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
                      className={`p-3 rounded-2xl cursor-pointer transition flex flex-col gap-1 border text-left ${
                        isSelected
                          ? 'border-signal-500/50 bg-signal-500/15 text-white shadow-[0_0_15px_-3px_rgba(0,245,160,0.25)]'
                          : 'border-white/[0.05] hover:border-white/10 hover:bg-white/[0.03] text-ink-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm truncate text-white">{n.title}</h4>
                        <span className="font-mono text-[10px] text-ink-400 shrink-0">
                          {new Date(n.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-400 line-clamp-2">
                        {n.body || '(Nota vacía)'}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Panel Derecho: Editor / Vista Detallada */}
          <div className="md:col-span-7 flex flex-col glass-card rounded-3xl p-4 sm:p-6 overflow-hidden border border-white/10 shadow-2xl">
            {isEditing || (!activeNote && notes.length === 0) ? (
              /* Modo Editor */
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-ink-200/60 dark:border-white/10 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-signal-400">
                    {activeNote ? 'Editando Nota' : 'Nueva Nota'}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeNote && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="btn-ghost text-xs px-3 py-1 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn-primary text-xs px-4 py-1.5 cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Título de la nota..."
                  className="w-full text-base sm:text-lg font-bold bg-transparent border-b border-ink-200/50 dark:border-white/5 py-2 focus:outline-none focus:border-signal-500"
                />

                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Escribe el contenido de tu nota aquí..."
                  className="flex-1 w-full bg-transparent resize-none py-2 text-sm sm:text-base leading-relaxed focus:outline-none scroll-thin"
                />
              </div>
            ) : activeNote ? (
              /* Modo Lectura */
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-200/60 dark:border-white/10 pb-3">
                  <span className="text-[11px] text-ink-400">
                    Última modificación: {new Date(activeNote.updatedAt).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {onSendToChat && (
                      <button
                        type="button"
                        onClick={() => onSendToChat(`Sobre mi nota "${activeNote.title}": ${activeNote.body}`)}
                        className="btn-ghost text-xs px-2.5 py-1 gap-1 text-signal-400 hover:text-signal-300 cursor-pointer"
                        aria-label="Preguntar a la IA sobre esta nota" title="Preguntar a la IA sobre esta nota"
                      >
                        <Icon name="message" size={13} />
                        Consultar IA
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(activeNote)}
                      className="btn-ghost text-xs px-2 py-1 gap-1 cursor-pointer"
                      aria-label="Copiar nota" title="Copiar nota"
                    >
                      <Icon name={copiedId === activeNote.id ? 'check' : 'copy'} size={13} />
                      {copiedId === activeNote.id ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="btn-ghost text-xs px-2.5 py-1 gap-1 cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(activeNote.id)}
                      className="p-1.5 rounded-lg text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 cursor-pointer"
                      aria-label="Eliminar" title="Eliminar"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-ink-900 dark:text-white pt-1">
                  {activeNote.title}
                </h2>

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
