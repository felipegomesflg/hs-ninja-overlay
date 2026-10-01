export type ModKind = 'buff' | 'debuff'

export interface ModInfo {
  id: number
  name: string
  desc: string
  kind: ModKind
}

export interface DropJournalEntry {
  id: string
  name: string
  rarity: string | null
  tier: number | null
  ground?: boolean
  at: number | null
}

export interface SatanicZoneState {
  ok: boolean
  path?: string
  error?: string
  /** Satanic Zone atual (mods / barra do topo) */
  zone: string | null
  /** Área onde o jogador está — usada nos target drops */
  area: string | null
  /** true se o heartbeat diz que a sala atual é a SZ */
  satanicHere?: boolean | null
  buffs: number[]
  debuffs: number[]
  /** Magic Find do personagem */
  mf?: number | null
  /** Histórico recente de drops do personagem */
  drops?: DropJournalEntry[]
  updatedAt?: string | null
  mtimeMs?: number
}

export interface DropItem {
  key: string
  name: string
  rarity: string | null
  tier: number | null
  /** Drop geral (qualquer lugar) */
  rate: number | null
  /** Drop da zona / chase (melhor, quando existe) */
  chase?: number | null
  places?: string[]
  zones?: string[]
  hasArea?: boolean
  icon?: [number, number, number, number] | null
  inferno?: boolean
}

export interface AreaInfo {
  room: string
  code: string | null
  act: number | null
  kind: string
  name: string
  boss?: string | null
  drops: DropItem[]
}

export interface OverlaySettings {
  watchPath: string
  clickThrough: boolean
  alwaysOnTop: boolean
}

export interface HsOverlayApi {
  getSettings: () => Promise<OverlaySettings>
  setSettings: (patch: Partial<OverlaySettings>) => Promise<OverlaySettings>
  pickWatchFile: () => Promise<OverlaySettings | null>
  readZoneNow: () => Promise<SatanicZoneState>
  /** Relê o live file e garante que o hs-capture está rodando */
  refreshLive: () => Promise<SatanicZoneState>
  minimize: () => Promise<void>
  /** Oculta para a bandeja */
  close: () => Promise<void>
  /** Encerra de verdade (também disponível no tray) */
  quit: () => Promise<void>
  openPath: (target: string) => Promise<void>
  /** true = cliques passam para o jogo; false = overlay captura o mouse */
  setMouseIgnore: (ignore: boolean) => Promise<void>
  /** Liga foco de teclado na overlay */
  setFocusable: (focusable: boolean) => Promise<void>
  /** Foca a janela (abrir busca / trocar aba) */
  focusWindow: () => Promise<void>
  /** Foco síncrono no mousedown do input */
  stealFocusSync: () => void
  onZoneUpdate: (cb: (data: SatanicZoneState) => void) => () => void
  onSettingsUpdate: (cb: (data: OverlaySettings) => void) => () => void
}

declare global {
  interface Window {
    hsOverlay?: HsOverlayApi
  }
}

export {}
