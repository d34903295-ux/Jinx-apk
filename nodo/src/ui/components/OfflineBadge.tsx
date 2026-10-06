import { t } from '../../i18n'
import type { LLMState } from '../../core/llm/llmClient'
import type { OfflineStatus } from '../../core/offline/installer'
import { Icon } from './Icon'

interface OfflineBadgeProps {
  online: boolean
  status: OfflineStatus | null
  llm: LLMState
}

/** Indicador táctico del estado offline: HUD de telemetría de alta tecnología */
export function OfflineBadge({ online, status, llm }: OfflineBadgeProps) {
  let tone: 'ok' | 'warn' | 'busy' = 'warn'
  let label = t('status.notReady')

  if (llm.status === 'loading') {
    tone = 'busy'
    label = t('status.loadingModel', { pct: Math.round((llm.progress?.progress ?? 0) * 100) })
  } else if (status?.modelCached && status.appCached) {
    tone = 'ok'
    label = t('status.offlineReady')
  } else if (status?.modelCached) {
    tone = 'ok'
    label = t('status.modelOnly')
  }

  const toneClass = {
    ok: 'border-signal-500/40 bg-signal-500/10 text-signal-400 shadow-[0_0_15px_-3px_rgba(0,245,160,0.25)]',
    warn: 'border-ember-500/40 bg-ember-500/10 text-ember-400 shadow-[0_0_15px_-3px_rgba(255,184,0,0.25)]',
    busy: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_-3px_rgba(0,210,255,0.25)]',
  }[tone]

  const dotClass = {
    ok: 'bg-signal-400 shadow-[0_0_8px_#00f5a0]',
    warn: 'bg-ember-400 shadow-[0_0_8px_#ffb800]',
    busy: 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#00d2ff]',
  }[tone]

  return (
    <div className="flex items-center gap-1.5 select-none">
      <div
        id="offline-status"
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase backdrop-blur-md transition-all ${toneClass}`}
      >
        <div className="relative flex items-center justify-center size-2.5">
          {tone === 'ok' && (
            <span className="absolute size-4 rounded-full bg-signal-400/40 animate-radar-ping" />
          )}
          <span className={`size-2 rounded-full ${dotClass}`} />
        </div>
        <span>{label}</span>
      </div>

      {!online && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] font-medium tracking-wider text-ink-300 backdrop-blur-md"
          title={t('status.noNetwork')}
        >
          <Icon name="wifiOff" size={12} className="text-ember-400" />
          <span>AIRGAPPED</span>
        </span>
      )}
    </div>
  )
}
