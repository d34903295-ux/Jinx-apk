import { lazy, Suspense, useEffect, useState } from 'react'
import { getSetting, setSetting } from './core/db/repo'
import { ChatView } from './ui/components/ChatView'
import { Icon, Logo } from './ui/components/Icon'
import { DynamicIsland } from './ui/components/DynamicIsland'
import { Snackbar } from './ui/components/Snackbar'
import { SplashScreen } from './ui/components/SplashScreen'
import { ThinkingOrb } from 'thinking-orbs'
import { activeNativeModel, nativeAction } from './core/native/bridge'

const LibraryView = lazy(() => import('./ui/components/LibraryView').then((m) => ({ default: m.LibraryView })))
const NotesView = lazy(() => import('./ui/components/NotesView').then((m) => ({ default: m.NotesView })))
const CodeView = lazy(() => import('./ui/components/CodeView').then((m) => ({ default: m.CodeView })))
const ModelsView = lazy(() => import('./ui/components/ModelsView').then((m) => ({ default: m.ModelsView })))
const SettingsView = lazy(() => import('./ui/components/SettingsView').then((m) => ({ default: m.SettingsView })))

type View = 'chat' | 'library' | 'code' | 'notes' | 'models' | 'settings'

const TABS: { id: View; label: string; icon: 'message' | 'library' | 'code' | 'copy' | 'cpu' | 'settings' }[] = [
  { id: 'chat', label: 'Chat', icon: 'message' },
  { id: 'library', label: 'Docs', icon: 'library' },
  { id: 'code', label: 'Código', icon: 'code' },
  { id: 'notes', label: 'Notas', icon: 'copy' },
  { id: 'models', label: 'Modelos', icon: 'cpu' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
]

export function App() {
  const [internalReady, setInternalReady] = useState(false)
  const [splashVisible, setSplashVisible] = useState(true)
  const [view, setView] = useState<View>('chat')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [codePayload, setCodePayload] = useState<{
    code: string
    lang?: 'javascript' | 'python' | 'html'
    autoRun?: boolean
  } | null>(null)

  // Escuchar apertura directa de código desde el agente nativo o evento custom
  useEffect(() => {
    const handleOpenCode = (e: any) => {
      const detail = e.detail || {}
      if (detail.code) {
        setCodePayload({
          code: detail.code,
          lang: detail.lang || 'html',
          autoRun: detail.autoRun ?? (detail.lang === 'html' || !detail.lang),
        })
        setView('code')
      }
    }
    window.addEventListener('nodo-open-code', handleOpenCode)
    return () => window.removeEventListener('nodo-open-code', handleOpenCode)
  }, [])

  // Cerrar drawer lateral con tecla Escape
  useEffect(() => {
    if (!drawerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

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
      const perf = await getSetting<boolean>('perfMode')
      if (perf) document.documentElement.classList.add('perf')
      setInternalReady(true)
    }
    const timer = setTimeout(() => {
      if (alive) {
        setInternalReady(true)
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


  return (
    <div className="h-dvh w-full bg-ink-50 dark:bg-ink-950 safe-x safe-top flex flex-col overflow-hidden relative">
      {splashVisible && (
        <SplashScreen
          isReady={internalReady}
          onComplete={() => setSplashVisible(false)}
        />
      )}
      <DynamicIsland onOpenModels={() => go('models')} />
      <Snackbar />
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
            className="size-9 rounded-full bg-black/90 border border-white/20 flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.25)] cursor-pointer overflow-hidden"
            aria-label="Jinx inicio" title="Jinx inicio"
          >
            <Logo size={24} />
          </button>
          <div className="flex flex-col">
            <span className="font-display font-bold tracking-tight text-lg text-ink-900 dark:text-white">Jinx</span>
            <span className="font-mono text-[9px] text-ink-400 dark:text-white/40 tracking-wider uppercase">OFFGRID // v2.0</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 scroll-thin stagger">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => go(tab.id)}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition cursor-pointer active:scale-[0.98] ${
                view === tab.id
                  ? 'bg-black/10 dark:bg-white/[0.12] text-ink-950 dark:text-white border border-black/15 dark:border-white/20 shadow-xs font-semibold'
                  : 'text-ink-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-ink-950 dark:hover:text-white border border-transparent'
              }`}
            >
              <Icon name={tab.icon} size={18} />
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false)
              nativeAction((n) => {
                n.openAgent()
                return 'ok'
              })
            }}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition cursor-pointer text-ink-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-ink-950 dark:hover:text-white border border-transparent active:scale-[0.98]"
            aria-label="Abrir Agente" title="Abrir Agente"
          >
            <Icon name="sparkles" size={18} />
            Agente
          </button>
        </nav>
        <div className="p-3 border-t border-ink-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => void handleToggleTheme()}
            className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm text-ink-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-ink-950 dark:hover:text-white transition cursor-pointer active:scale-[0.98]"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </aside>

      {/* Contenido con transición */}
      <div key={view} className="flex-1 min-h-0 flex flex-col animate-page-in">
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 app-backdrop">
              <ThinkingOrb state="breathing" size={32} color="#ffffff" aria-label="Cargando..." />
              <span className="font-mono text-xs text-ink-400">Cargando sección...</span>
            </div>
          }
        >
          {view === 'library' ? (
            <LibraryView
              onBack={() => setView('chat')}
              onAskDoc={(docName) => {
                setInitialPrompt(docName)
                setView('chat')
              }}
            />
          ) : view === 'code' ? (
            <CodeView
              onBack={() => setView('chat')}
              initialCode={codePayload?.code}
              initialLang={codePayload?.lang}
              autoRun={codePayload?.autoRun}
              onSendToChat={(codePrompt) => {
                setInitialPrompt(codePrompt)
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
              onOpenModels={() => setView('models')}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          ) : (
            <ChatView
              onOpenDrawer={() => setDrawerOpen(true)}
              onOpenLibrary={() => setView('library')}
              onOpenCode={(payload) => {
                if (payload) setCodePayload(payload)
                setView('code')
              }}
              onOpenNotes={() => setView('notes')}
              onOpenModels={() => setView('models')}
              onOpenSettings={() => setView('settings')}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              initialPrompt={initialPrompt}
              onClearInitialPrompt={() => setInitialPrompt(null)}
            />
          )}
        </Suspense>
      </div>

      {/* Barra inferior de navegación */}
      <nav aria-label="Navegación principal" className="shrink-0 z-20 px-2 sm:px-3 pb-2 pt-1 safe-bottom">
        <div className="glass-tabbar rounded-full flex items-center justify-around py-1 px-1 sm:px-1.5 max-w-lg mx-auto border border-black/10 dark:border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {TABS.map((tab) => {
            const isActive = view === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => go(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-1.5 sm:px-2.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer min-w-[46px] sm:min-w-[54px] min-h-[44px] active:scale-90 motion-reduce:active:scale-100 ${
                  isActive
                    ? 'text-black dark:text-white bg-black/10 dark:bg-white/[0.14] border border-black/15 dark:border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] font-semibold'
                    : 'text-ink-500 dark:text-white/45 hover:text-ink-900 dark:hover:text-white/85 border border-transparent'
                }`}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon name={tab.icon} size={18} />
                <span className="text-[9.5px] sm:text-[10px] leading-tight tracking-tight font-medium">{tab.label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 size-1 rounded-full bg-black dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] animate-fade-in"
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default App
