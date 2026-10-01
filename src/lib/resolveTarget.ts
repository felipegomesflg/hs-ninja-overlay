import dropsData from '../data/drops.json'
import roomsData from '../data/rooms.json'
import { playerLocationKeys } from './mods'
import type { AreaInfo, DropItem } from '../types'

type BossInfo = {
  key: string
  name: string
  kind: string | null
  infernoOnly: boolean
  drops: (DropItem & { inferno?: boolean })[]
}

const data = dropsData as unknown as {
  areas: AreaInfo[]
  bosses?: Record<string, BossInfo>
  roomToBoss?: Record<string, string>
}
const areas = data.areas
const bosses = data.bosses || {}
const roomToBoss = data.roomToBoss || {}
const ROOMS = (roomsData as { rooms: Record<string, string> }).rooms

export type TargetContext =
  | {
      kind: 'boss'
      id: string
      name: string
      room: string
      roomLabel: string
      drops: (DropItem & { inferno?: boolean })[]
    }
  | {
      kind: 'area'
      id: string
      name: string
      room: string
      roomLabel: string
      drops: DropItem[]
    }
  | null

function resolveBossKey(location: string): string | null {
  const keys = [location, ...playerLocationKeys(location)]
  for (const key of keys) {
    if (roomToBoss[key]) return roomToBoss[key]
    const byName = Object.entries(roomToBoss).find(
      ([room]) => room.toLowerCase() === key.toLowerCase(),
    )
    if (byName) return byName[1]
  }
  // nome amigável: "Reaper's Breach" → Shadow_Boss_rm via ROOMS invertido
  const lower = location.toLowerCase()
  for (const [room, label] of Object.entries(ROOMS)) {
    if (label.toLowerCase() === lower && roomToBoss[room]) return roomToBoss[room]
  }
  return null
}

function findArea(location: string): AreaInfo | null {
  const keys = playerLocationKeys(location)
  for (const key of keys) {
    const lower = key.toLowerCase()
    const hit = areas.find(
      (a) =>
        a.room === key ||
        a.room?.toLowerCase() === lower ||
        a.code === key ||
        a.code?.toLowerCase() === lower ||
        a.name.toLowerCase() === lower,
    )
    if (hit) return hit
  }
  return null
}

/** Decide target drops: boss room ganha prioridade sobre a zona. */
export function resolveTarget(location: string | null): TargetContext {
  if (!location) return null
  const roomLabel = ROOMS[location] || location

  const bossKey = resolveBossKey(location)
  if (bossKey && bosses[bossKey]) {
    const boss = bosses[bossKey]
    return {
      kind: 'boss',
      id: boss.key,
      name: boss.name,
      room: location,
      roomLabel,
      drops: boss.drops,
    }
  }

  const area = findArea(location)
  if (area) {
    return {
      kind: 'area',
      id: area.room,
      name: area.name,
      room: area.room,
      roomLabel: area.name,
      drops: area.drops,
    }
  }

  return null
}
