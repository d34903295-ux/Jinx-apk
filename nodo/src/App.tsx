import { useEffect, useState } from 'react'
import { getSetting, setSetting } from './core/db/repo'
import { getOfflineStatus } from './core/offline/installer'
import { llm } from './core/llm/llmClient'
import { SetupWizard } from './ui/components/SetupWizard'
import { ChatView } from './ui/components/ChatView'
import { LibraryView } from './ui/components/LibraryView'
import { NotesView } from './ui/components/NotesView'
import { SettingsView } from './ui/components/SettingsView'
import { Icon, Logo } from './ui/components/Icon'
import { t } from './i18n'

export function App() {
  const [booting, setBooting] = useState(true)
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [view, setView] = useState<'chat' | 'setup' | 'library' | 'notes' | 'settings'>('chat')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)

  // Inicialización de tema y modelo guardado
  useEffect(() => {
    let alive = true
    async function boot() {
      // 1. Tema
      const savedTheme = (await getSetting<'dark' | 'light'>('theme')) ?? 'dark'
      if (!alive) return
      setTheme(savedTheme)
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      // 2. Estado offline y modelo
      try {
        const status = await getOfflineStatus()
        if (!alive) return
        if (status.modelId) {
          setActiveModel(status.modelId)
          setView('chat')
          // Cargar el modelo en segundo plano (desde caché, sin red)
          llm.load(status.modelId).catch((err) => {
            console.warn('Auto-load model notice:', err)
          })
        } else {
          // No hay modelo instalado todavía -> Asistente de configuración
          setView('setup')
        }
      } catch (err) {
        if (!alive) return
        console.error('Boot error:', err)
        setView('setup')
      } finally {
        if (alive) setBooting(false)
      }
    }
    void boot()
    return () => {
      alive = false
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

  const handleSetupComplete = async () => {
    const status = await getOfflineStatus()
    if (status.modelId) {
      setActiveModel(status.modelId)
      setView('chat')
    }
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
    <div className="min-h-screen w-full bg-ink-50 dark:bg-ink-950 safe-x safe-top">
      <div key={view} className="animate-page-in min-h-screen">
      {view === 'setup' ? (
        <SetupWizard
          onComplete={handleSetupComplete}
          canCancel={Boolean(activeModel)}
          onCancel={() => setView('chat')}
        />
      ) : view === 'library' ? (
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
      ) : view === 'settings' ? (
        <SettingsView
          activeModelId={activeModel}
          onBack={() => setView('chat')}
          onModelChanged={(newModelId) => {
            setActiveModel(newModelId)
            setView('chat')
          }}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        <ChatView
          activeModelId={activeModel}
          onChangeModel={() => setView('setup')}
          onOpenLibrary={() => setView('library')}
          onOpenNotes={() => setView('notes')}
          onOpenSettings={() => setView('settings')}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          initialPrompt={initialPrompt}
          onClearInitialPrompt={() => setInitialPrompt(null)}
        />
      )}
      </div>
    </div>
  )
}

export default App

