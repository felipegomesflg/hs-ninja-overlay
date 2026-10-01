import { useEffect, useRef, useState } from 'react'
import { SatanicBar } from './components/SatanicBar'
import { SidePanel } from './components/SidePanel'
import { StashPanel } from './components/StashPanel'
import { SzDropsPanel } from './components/SzDropsPanel'
import { useClickThrough } from './hooks/useClickThrough'
import type { OverlaySettings, SatanicZoneState } from './types'
import './App.css'

const emptyZone: SatanicZoneState = {
  ok: false,
  zone: null,
  area: null,
  buffs: [],
  debuffs: [],
  mf: null,
  drops: [],
  error: 'Aguardando arquivo…',
}

type PanelMode = 'drops' | 'search' | 'loot' | null

/** Evita wipe completo; mantém SZ/mods. Sala null (act mudou) é respeitada. */
function mergeZoneState(prev: SatanicZoneState, next: SatanicZoneState): SatanicZoneState {
  const empty =
    next.zone == null &&
    next.area == null &&
    next.mf == null &&
    (next.buffs?.length ?? 0) === 0 &&
    (next.debuffs?.length ?? 0) === 0 &&
    (next.drops?.length ?? 0) === 0

  if (empty && (prev.zone || prev.area || prev.mf != null)) {
    return {
      ...prev,
      ...next,
      ok: next.ok || prev.ok,
      zone: prev.zone,
      area: prev.area,
      buffs: prev.buffs,
      debuffs: prev.debuffs,
      mf: prev.mf,
      drops: prev.drops ?? [],
      satanicHere: next.satanicHere ?? prev.satanicHere ?? null,
    }
  }

  const sameZone = Boolean(next.zone) && next.zone === prev.zone
  const keepMods =
    next.zone == null ||
    (sameZone && (next.buffs?.length ?? 0) === 0 && (next.debuffs?.length ?? 0) === 0 && (prev.buffs.length > 0 || prev.debuffs.length > 0))

  return {
    ...next,
    zone: next.zone ?? prev.zone ?? null,
    area: next.area !== undefined ? next.area : prev.area,
    buffs: keepMods ? prev.buffs : next.buffs ?? [],
    debuffs: keepMods ? prev.debuffs : next.debuffs ?? [],
    mf: next.mf ?? prev.mf ?? null,
    drops: next.drops ?? prev.drops ?? [],
    satanicHere: next.satanicHere ?? prev.satanicHere ?? null,
  }
}

export default function App() {
  const [zone, setZone] = useState<SatanicZoneState>(emptyZone)
  const [settings, setSettings] = useState<OverlaySettings | null>(null)
  const [panel, setPanel] = useState<PanelMode>(null)
  const [szDropsOpen, setSzDropsOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadDrops, setUnreadDrops] = useState(0)
  const knownDropIds = useRef(new Set<string>())
  const dropsPrimed = useRef(false)

  useClickThrough()

  const applyZone = (next: SatanicZoneState) => {
    setZone((prev) => mergeZoneState(prev, next))
  }

  useEffect(() => {
    const api = window.hsOverlay
    if (!api) {
      setZone({
        ok: true,
        zone: 'SZ_5_5',
        area: 'Act_01_02',
        buffs: [3, 14, 10],
        debuffs: [2, 17, 15],
        mf: 2009,
        drops: [
          {
            id: 'demo-1',
            name: "Azazel's Despair",
            rarity: 'Satanic',
            tier: 5,
            at: Date.now(),
          },
          {
            id: 'demo-2',
            name: 'Gold',
            rarity: null,
            tier: null,
            at: Date.now() - 60_000,
          },
        ],
        path: 'sample',
      })
      setSettings({
        watchPath: 'public/sample/satanic-zone.txt',
        clickThrough: true,
        alwaysOnTop: true,
      })
      return
    }

    api.getSettings().then(setSettings)
    api.readZoneNow().then(applyZone)

    const offZone = api.onZoneUpdate(applyZone)
    const offSettings = api.onSettingsUpdate(setSettings)

    // Poll lento só como rede de segurança — hot path é stdout HSLIVE → IPC.
    const poll = window.setInterval(() => {
      void api.readZoneNow().then(applyZone)
    }, 5000)

    return () => {
      offZone()
      offSettings()
      window.clearInterval(poll)
    }
  }, [])

  // Badge vermelha: drops novos enquanto o painel de loot está fechado
  useEffect(() => {
    const drops = zone.drops ?? []
    if (!dropsPrimed.current) {
      for (const d of drops) knownDropIds.current.add(d.id)
      dropsPrimed.current = true
      setUnreadDrops(0)
      return
    }

    if (panel === 'loot') {
      for (const d of drops) knownDropIds.current.add(d.id)
      setUnreadDrops(0)
      return
    }

    let unread = 0
    for (const d of drops) {
      if (!knownDropIds.current.has(d.id)) unread += 1
    }
    setUnreadDrops(unread)
  }, [zone.drops, panel])

  const refreshLive = async () => {
    const api = window.hsOverlay
    if (!api) return
    setRefreshing(true)
    try {
      const next = api.refreshLive ? await api.refreshLive() : await api.readZoneNow()
      applyZone(next)
    } finally {
      window.setTimeout(() => setRefreshing(false), 400)
    }
  }

  const togglePanel = (mode: Exclude<PanelMode, null>) => {
    setPanel((prev) => (prev === mode ? null : mode))
  }

  return (
    <div className="overlay-root">
      <div className="slot-top" data-overlay-hit>
        <div className="sz-row">
          <SatanicBar
            zone={zone}
            onRefresh={refreshLive}
            refreshing={refreshing}
            szDropsOpen={szDropsOpen}
            onToggleSzDrops={() => setSzDropsOpen((v) => !v)}
          />
          <SzDropsPanel
            open={szDropsOpen}
            satanicZone={zone.zone}
            onClose={() => setSzDropsOpen(false)}
          />
        </div>
      </div>

      <div className="slot-rail-left" data-overlay-hit>
        <button
          type="button"
          className={`rail-btn rail-btn--left rail-btn--loot ${panel === 'loot' ? 'open' : ''}`}
          onClick={() => togglePanel('loot')}
          aria-label="Histórico de drops"
          title="Histórico de drops / MF"
        >
          <span aria-hidden>◈</span>
          {unreadDrops > 0 && panel !== 'loot' ? (
            <span className="rail-badge" aria-label={`${unreadDrops} drops novos`} />
          ) : null}
        </button>
      </div>

      <div
        className={`slot-loot ${panel === 'loot' ? 'visible' : ''}`}
        data-overlay-hit={panel === 'loot' ? '' : undefined}
      >
        <StashPanel
          open={panel === 'loot'}
          mf={zone.mf}
          drops={zone.drops ?? []}
          onClose={() => setPanel(null)}
        />
      </div>

      <div className="slot-rail" data-overlay-hit>
        <button
          type="button"
          className={`rail-btn rail-btn--search ${panel === 'search' ? 'open' : ''}`}
          onClick={() => togglePanel('search')}
          aria-label="Buscar target farms"
          title="Buscar target farms"
        >
          <span aria-hidden>⌕</span>
        </button>
        <button
          type="button"
          className={`rail-btn rail-btn--drops ${panel === 'drops' ? 'open' : ''}`}
          onClick={() => togglePanel('drops')}
          aria-label="Abrir drops da área"
          title="Drops target da área"
        >
          <span aria-hidden>{panel === 'drops' ? '›' : '‹'}</span>
        </button>
      </div>

      <div
        className={`slot-drops ${panel === 'drops' ? 'visible' : ''}`}
        data-overlay-hit={panel === 'drops' ? '' : undefined}
      >
        <SidePanel
          open={panel === 'drops'}
          mode="drops"
          playerArea={zone.area}
          onClose={() => setPanel(null)}
          onRefresh={refreshLive}
          refreshing={refreshing}
        />
      </div>

      <div
        className={`slot-search ${panel === 'search' ? 'visible' : ''}`}
        data-overlay-hit={panel === 'search' ? '' : undefined}
      >
        <SidePanel
          open={panel === 'search'}
          mode="search"
          playerArea={zone.area}
          onClose={() => setPanel(null)}
          onRefresh={refreshLive}
          refreshing={refreshing}
        />
      </div>

      <div className={`slot-controls ${controlsOpen ? 'open' : ''}`} data-overlay-hit>
        <button
          type="button"
          className="ctrl-toggle"
          onClick={() => setControlsOpen((v) => !v)}
          aria-label="Controles"
          title="Controles"
        >
          ···
        </button>
        {controlsOpen ? (
          <div className="ctrl-menu">
            <div className="ctrl-status" title={settings?.watchPath}>
              <div>SZ: {zone.zone || '—'}</div>
              <div>Área: {zone.area || '—'}</div>
              <div>MF: {zone.mf != null ? zone.mf : '—'}</div>
              <div className="ctrl-path">{settings?.watchPath || 'sem arquivo'}</div>
            </div>
            <button type="button" onClick={() => void refreshLive()}>
              Atualizar
            </button>
            <button type="button" onClick={() => window.hsOverlay?.pickWatchFile()} title={settings?.watchPath}>
              Escolher .txt
            </button>
            <button type="button" onClick={() => window.hsOverlay?.minimize()}>
              Ocultar
            </button>
            <button type="button" onClick={() => window.hsOverlay?.quit?.() ?? window.hsOverlay?.close()}>
              Sair
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
