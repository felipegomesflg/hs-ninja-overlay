import modsData from '../data/mods.json'
import roomsData from '../data/rooms.json'
import type { ModInfo } from '../types'

const buffModules = import.meta.glob('../assets/buffs/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

import defaultIcon from '../assets/satanic_star.png'

export const mods = modsData
const ROOMS = (roomsData as { rooms: Record<string, string> }).rooms

export function buffIcon(id: number): string {
  return buffModules[`../assets/buffs/${id}.png`] ?? defaultIcon
}

export function getBuff(id: number): ModInfo {
  const b = (mods.buffs as Record<string, ModInfo>)[String(id)]
  if (!b) return { id, name: `Buff desconhecido ${id}`, desc: '', kind: 'buff' }
  return b
}

export function getDebuff(id: number): ModInfo {
  const d = (mods.debuffs as Record<string, ModInfo>)[String(id)]
  if (!d) return { id, name: `Debuff desconhecido ${id}`, desc: '', kind: 'debuff' }
  return d
}

/** Igual ao hs-tracker: Act_08_02 e SZ_8_2 → "Flooded Plains" */
export function zoneLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  return roomLabel(raw)
}

/** Nome amigável da sala do jogador (Act_09_04, Shadow_Boss_rm, …) */
export function roomLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  const s = String(raw).trim()

  if (ROOMS[s]) return ROOMS[s]

  const pair = s.match(/^(?:SZ|Satanic|Act)_0*(\d+)_0*(\d+)$/i)
  if (pair) {
    const act = Number(pair[1])
    const idx = Number(pair[2])
    const padded = `Act_${String(act).padStart(2, '0')}_${String(idx).padStart(2, '0')}`
    if (ROOMS[padded]) return ROOMS[padded]
    const names = (mods.zones as Record<string, string[]>)[String(act)]
    if (names && idx >= 1 && idx <= names.length) return names[idx - 1]
    return `Act ${act} · Zone ${idx}`
  }

  return s
}

/** Map SZ_5_5 / Satanic_5_5 / Act_05_05 → map area code "5-5" */
export function zoneToAreaCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = String(raw).match(/(?:SZ|Satanic|Act)_0*(\d+)_0*(\d+)/i)
  if (!m) return null
  return `${Number(m[1])}-${Number(m[2])}`
}

/**
 * Resolve a localização do jogador para code/room do map.
 * Aceita: Act_01_02, 1-2, 1-BD, nome da área, room id.
 */
export function playerLocationKeys(raw: string | null | undefined): string[] {
  if (!raw) return []
  const s = String(raw).trim()
  if (!s) return []

  const keys = new Set<string>([s, s.toLowerCase()])

  // Act_01_02 / Act_1_2 → 1-2
  const actZone = s.match(/^Act_0*(\d+)_0*(\d+)$/i)
  if (actZone) {
    keys.add(`${actZone[1]}-${actZone[2]}`)
    keys.add(`Act_${actZone[1].padStart(2, '0')}_${actZone[2].padStart(2, '0')}`)
    keys.add(`Act_${Number(actZone[1])}_${Number(actZone[2])}`)
  }

  // Act_01_Boss_Dungeon_03 → keep room; also try N-BD
  const actBd = s.match(/^Act_0*(\d+)_Boss_Dungeon/i)
  if (actBd) {
    keys.add(`${actBd[1]}-BD`)
  }

  // Already a code like 5-5 or 1-BD
  if (/^\d+-(?:\d+|BD)$/i.test(s)) {
    keys.add(s.toUpperCase().replace(/bd$/i, 'BD'))
  }

  return [...keys]
}

export function formatOdds(rate: number | null | undefined): string {
  if (!rate || rate <= 0) return '—'
  if (rate >= 1_000_000) return `1 in ${(rate / 1_000_000).toFixed(rate >= 10_000_000 ? 0 : 1)}M`
  if (rate >= 1000) return `1 in ${Math.round(rate / 1000)}k`
  return `1 in ${Math.round(rate)}`
}

/** Odds da zona (chase) preferidos; cai no rate geral. */
export function zoneOdds(item: { rate?: number | null; chase?: number | null }): number | null {
  if (item.chase != null && item.chase > 0) return item.chase
  if (item.rate != null && item.rate > 0) return item.rate
  return null
}

export { defaultIcon }
