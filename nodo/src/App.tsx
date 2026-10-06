import { useEffect, useState } from 'react'
import { getSetting, setSetting } from './core/db/repo'
import { ChatView } from './ui/components/ChatView'
import { LibraryView } from './ui/components/LibraryView'
import { NotesView } from './ui/components/NotesView'
import { SettingsView } from './ui/components/SettingsView'
import { ModelsView } from './ui/components/ModelsView'
import { Icon, Logo } from './ui/components/Icon'
import { activeNativeModel } from './core/native/bridge'
import { t } from './i18n'

type View = 'chat' | 'library' | 'notes' | 'models' | 'settings'

const TABS: { id: View; label: string; icon: 'message' | 'library' | 'cpu' | 'copy' | 'settings' }[] = [
  { id: 'chat', label: 'Chat', icon: 'message' },
  { id: 'library', label: 'Docs', icon: 'library' },
  { id: 'models', label: 'Modelos', icon: 'cpu' },
  { id: 'notes', label: 'Notas', icon: 'copy' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
]

export function App() {
  const [booting, setBooting] = useState(true)
  const [view, setView] = useState<View>('chat')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)

  // La app abre directo al chat: descargar el modelo es opcional (sección Modelos).
  useEffect(() => {
    let alive = true
    async function boot() {
      const savedTheme = (await getSetting<'dark' | 'light'>('theme')) ?? 'dark'
      if (!alive) return
      setTheme(savedTheme)
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      setView('chat')
      setBooting(false)
    }
    const timer = setTimeout(() => {
      if (alive) {
        setView('chat')
        setBooting(false)
      }
    }, 8000)
    void boot().finally(() => clearTimeout(timer))
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    await setSetting('theme', nextTheme)
  }

  const go = (v: View) => {
    setView(v)
    setDrawerOpen(false)
  }

  if (booting) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-ink-950 text-white gap-4 select-none app-backdrop safe-top safe-bottom safe-x">
        <div className="size-16 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-2xl shadow-signal-500/25 animate-pulse">
          <Logo size={36} />
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-400 font-medium">
          <Icon name="refresh" size={16} className="animate-spin text-signal-400" />
          <span>{t('boot.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-ink-50 dark:bg-ink-950 safe-x safe-top flex flex-col overflow-hidden">
      {/* Drawer lateral (el logo lo abre) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-xs cursor-pointer animate-fade-in"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-ink-200/70 dark:border-white/[0.07] bg-white/95 dark:bg-ink-900/95 backdrop-blur-2xl transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/[0.07] flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => go('chat')}
            className="size-9 rounded-xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 cursor-pointer"
            aria-label="NODO inicio" title="NODO inicio"
          >
            <Logo size={20} />
          </button>
          <div className="flex flex-col">
            <span className="font-display font-bold tracking-tight text-lg text-ink-900 dark:text-white">NODO</span>
            <span className="font-mono text-[9px] text-signal-400 tracking-wider uppercase">OFFGRID // v2.0</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 scroll-thin">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition cursor-pointer ${
                view === tab.id
                  ? 'bg-signal-500/10 text-signal-700 dark:text-signal-300 border border-signal-500/30'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon name={tab.icon} size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-ink-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => void handleToggleTheme()}
            className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-white/[0.04] transition cursor-pointer"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </aside>

      {/* Contenido con transición */}
      <div key={view} className="flex-1 min-h-0 flex flex-col animate-page-in">
        {view === 'library' ? (
          <LibraryView
            onBack={() => setView('chat')}
            onAskDoc={(docName) => {
              setInitialPrompt(docName)
              setView('chat')
            }}
          />
        ) : view === 'notes' ? (
          <NotesView
            onBack={() => setView('chat')}
            onSendToChat={(noteText) => {
              setInitialPrompt(noteText)
              setView('chat')
            }}
          />
        ) : view === 'models' ? (
          <ModelsView onBack={() => setView('chat')} />
        ) : view === 'settings' ? (
          <SettingsView
            activeModelId={activeNativeModel()}
            onBack={() => setView('chat')}
            onModelChanged={() => setView('chat')}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        ) : (
          <ChatView
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenLibrary={() => setView('library')}
            onOpenNotes={() => setView('notes')}
            onOpenModels={() => setView('models')}
            onOpenSettings={() => setView('settings')}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            initialPrompt={initialPrompt}
            onClearInitialPrompt={() => setInitialPrompt(null)}
          />
        )}
      </div>

      {/* Barra inferior */}
      <nav className="shrink-0 z-10 px-3 pt-1 safe-bottom">
        <div className="glass rounded-2xl flex items-center justify-around py-1.5 shadow-2xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition cursor-pointer min-w-[56px] ${
                view === tab.id ? 'text-signal-400' : 'text-ink-400 hover:text-ink-200'
              }`}
              aria-label={tab.label} title={tab.label}
            >
              <Icon name={tab.icon} size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default App
