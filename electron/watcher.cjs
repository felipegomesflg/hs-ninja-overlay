const fs = require('node:fs')
const path = require('node:path')
const { watch } = require('chokidar')

/**
 * Parse the game/update text file into:
 *  - zone  → Satanic Zone (SZ_5_5 / Satanic_5_5)
 *  - area  → onde o jogador está (Act_01_02 / 1-2)
 *
 * JSON aceito (exemplos):
 *  { "satanic_zone_name": "SZ_5_5", "room": "Act_01_02", "zone_buffs": [3,14], "zone_debuffs": [2,17] }
 *  { "zone": "SZ_5_5", "area": "Act_01_02", "buffs": [...], "debuffs": [...] }
 *
 * Importante: "zone" genérico SÓ vira Satanic Zone se o valor parecer SZ/Satanic_.
 * Se parecer Act_XX_YY, trata como área do jogador.
 */
function parseIds(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => Number.isFinite(n) && n > 0)
  }
  if (typeof value === 'number') return value > 0 ? [value] : []
  if (typeof value !== 'string') return []
  return value
    .split(/[|,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function parseDrops(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((d, i) => {
      if (!d || typeof d !== 'object') return null
      const name = String(d.name || '').trim()
      if (!name) return null
      const id = String(d.id || d.hash || d.fingerprint || `${name}-${d.at || i}`)
      return {
        id,
        name,
        rarity: d.rarity != null ? String(d.rarity) : null,
        tier: Number.isFinite(Number(d.tier)) ? Number(d.tier) : null,
        ground: d.ground === true,
        at: Number.isFinite(Number(d.at)) ? Number(d.at) : null,
      }
    })
    .filter(Boolean)
}

function looksLikeSatanicZone(value) {
  if (value == null) return false
  const s = String(value).trim()
  return /^(?:SZ|Satanic)_0*\d+_0*\d+$/i.test(s)
}

function looksLikePlayerArea(value) {
  if (value == null) return false
  const s = String(value).trim()
  return /^Act_\d+/i.test(s) || /^\d+-(?:\d+|BD)$/i.test(s) || /^Town_/i.test(s)
}

function normalizeSatanicZone(value) {
  if (!value) return null
  const s = String(value).trim()
  // Satanic_5_5 / SZ_5_5 / Act_05_05 — o tracker trata as três como o mesmo lugar
  // quando vêm do campo satanic_zone_name
  const m = s.match(/^(?:SZ|Satanic|Act)_0*(\d+)_0*(\d+)$/i)
  if (m) return `SZ_${Number(m[1])}_${Number(m[2])}`
  return looksLikeSatanicZone(s) ? s : null
}

function pickSatanicZone(obj) {
  const candidates = [
    obj.satanic_zone_name,
    obj.satanic_zone,
    obj.satanicZone,
    obj.satanicZoneName,
    obj.sz,
    obj.SZ,
  ]
  for (const c of candidates) {
    const n = normalizeSatanicZone(c)
    if (n) return n
  }
  // "zone" genérico só com prefixo SZ/Satanic (Act_ sozinho = room do jogador)
  if (obj.zone && /^(?:SZ|Satanic)_/i.test(String(obj.zone))) {
    return normalizeSatanicZone(obj.zone)
  }
  return null
}

function pickPlayerArea(obj) {
  const candidates = [
    obj.area,
    obj.room,
    obj.current_area,
    obj.currentArea,
    obj.player_area,
    obj.playerArea,
    obj.location,
    obj.player_room,
    obj.playerRoom,
    obj.current_room,
    obj.currentRoom,
  ]
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim()
  }
  // Se "zone" for Act_XX_YY (e não SZ), é a área do jogador
  if (obj.zone && looksLikePlayerArea(obj.zone) && !looksLikeSatanicZone(obj.zone)) {
    return String(obj.zone).trim()
  }
  return null
}

function parseSatanicText(text) {
  const raw = String(text || '').trim()
  if (!raw) {
    return {
      zone: null,
      area: null,
      buffs: [],
      debuffs: [],
      mf: null,
      drops: [],
      updatedAt: null,
      rawPreview: '',
    }
  }

  if (raw.startsWith('{') || raw.startsWith('[')) {
    const data = JSON.parse(raw)
    const obj = Array.isArray(data) ? data[0] : data
    let zone = pickSatanicZone(obj)
    const area = pickPlayerArea(obj)
    const satanicHere = obj.satanic_here === true || obj.satanicHere === true || obj.sz === true
    // Se está na SZ e o anúncio ainda não veio, deriva SZ_x_y da sala Act_xx_yy
    if (!zone && satanicHere && area) {
      const m = String(area).match(/^Act_0*(\d+)_0*(\d+)$/i)
      if (m) zone = `SZ_${Number(m[1])}_${Number(m[2])}`
    }
    const mfRaw = obj.mf ?? obj.magic_find ?? obj.magicFind
    const mf =
      mfRaw != null && Number.isFinite(Number(mfRaw)) ? Number(mfRaw) : null
    const drops = parseDrops(obj.drops ?? obj.drop_journal ?? obj.dropJournal)
    return {
      zone,
      area,
      satanicHere: obj.satanic_here ?? obj.satanicHere ?? null,
      buffs: parseIds(obj.buffs ?? obj.zone_buffs ?? obj.zoneBuffs ?? obj.satanicZoneBuffs),
      debuffs: parseIds(obj.debuffs ?? obj.zone_debuffs ?? obj.zoneDebuffs ?? obj.satanicZoneDebuffs),
      mf,
      drops,
      updatedAt: obj.updatedAt || obj.updated_at || null,
      rawPreview: raw.slice(0, 200),
    }
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let zone = null
  let area = null
  let buffs = []
  let debuffs = []

  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/)
    if (kv) {
      const key = kv[1].toLowerCase()
      const val = kv[2].trim()
      if (key.includes('buff') && !key.includes('debuff')) {
        buffs = parseIds(val)
      } else if (key.includes('debuff')) {
        debuffs = parseIds(val)
      } else if (
        key === 'area' ||
        key === 'room' ||
        key === 'location' ||
        key === 'current_area' ||
        key === 'player_area' ||
        key === 'player_room' ||
        key === 'current_room'
      ) {
        area = val
      } else if (
        key.includes('satanic') ||
        key === 'sz' ||
        key === 'satanic_zone' ||
        key === 'satanic_zone_name'
      ) {
        zone = normalizeSatanicZone(val) || val
      } else if (key === 'zone') {
        if (looksLikeSatanicZone(val)) zone = normalizeSatanicZone(val)
        else if (looksLikePlayerArea(val)) area = val
        else zone = val
      }
      continue
    }
    if (looksLikeSatanicZone(line)) {
      zone = normalizeSatanicZone(line)
      continue
    }
    if (looksLikePlayerArea(line)) {
      area = line
    }
  }

  return {
    zone,
    area,
    buffs,
    debuffs,
    mf: null,
    drops: [],
    updatedAt: null,
    rawPreview: raw.slice(0, 200),
  }
}

function readFileSafe(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return { path: filePath, ...parseSatanicText(text), mtimeMs: fs.statSync(filePath).mtimeMs }
}

function watchSatanicFile(filePath, { onUpdate, onMissing, onError }) {
  const abs = path.resolve(filePath)
  let lastPayload = ''
  let pollTimer = null

  const emit = () => {
    try {
      if (!fs.existsSync(abs)) {
        onMissing?.()
        return
      }
      const payload = readFileSafe(abs)
      const fingerprint = JSON.stringify({
        zone: payload.zone,
        area: payload.area,
        buffs: payload.buffs,
        debuffs: payload.debuffs,
        mf: payload.mf ?? null,
        dropsHead: payload.drops?.[0]?.id ?? null,
        dropsLen: payload.drops?.length ?? 0,
        mtimeMs: payload.mtimeMs,
      })
      if (fingerprint === lastPayload) return
      lastPayload = fingerprint
      onUpdate?.(payload)
    } catch (err) {
      onError?.(err)
    }
  }

  emit()

  const watcher = watch(abs, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 30, pollInterval: 10 },
    usePolling: true,
    interval: 100,
  })

  watcher.on('add', emit)
  watcher.on('change', emit)
  watcher.on('unlink', () => onMissing?.())
  watcher.on('error', (err) => onError?.(err))

  const dirWatcher = watch(path.dirname(abs), {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    usePolling: true,
    interval: 200,
  })
  dirWatcher.on('add', (p) => {
    if (path.resolve(p) === abs) emit()
  })
  dirWatcher.on('change', (p) => {
    if (path.resolve(p) === abs) emit()
  })

  // Poll de segurança: hot path é stdout do capture → IPC.
  pollTimer = setInterval(emit, 2000)

  return {
    close() {
      if (pollTimer) clearInterval(pollTimer)
      watcher.close()
      dirWatcher.close()
    },
  }
}

module.exports = {
  parseSatanicText,
  watchSatanicFile,
  parseIds,
  parseDrops,
  normalizeSatanicZone,
  looksLikeSatanicZone,
  looksLikePlayerArea,
}
