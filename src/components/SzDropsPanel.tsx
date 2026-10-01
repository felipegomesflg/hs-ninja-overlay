import { useMemo } from 'react'
import dropsData from '../data/drops.json'
import { formatDropName, rarityClass } from '../lib/rarity'
import { zoneLabel, zoneToAreaCode } from '../lib/mods'
import { resolveTarget, type TargetContext } from '../lib/resolveTarget'
import type { DropItem } from '../types'
import { DropOdds } from './DropOdds'
import { ItemIcon } from './ItemIcon'

const sheet = (dropsData as { sheet?: { w: number; h: number } }).sheet ?? { w: 1024, h: 3506 }

/** SZ_8_2 → drops da zona correspondente (Act_08_02 / code 8-2). */
export function resolveSatanicDrops(sz: string | null | undefined): TargetContext {
  if (!sz) return null
  const code = zoneToAreaCode(sz)
  const keys: string[] = []
  if (code) {
    keys.push(code)
    const [a, b] = code.split('-')
    if (a && b) {
      keys.push(`Act_${a.padStart(2, '0')}_${b.padStart(2, '0')}`)
      keys.push(`Act_${Number(a)}_${Number(b)}`)
    }
  }
  keys.push(sz)
  for (const key of keys) {
    const hit = resolveTarget(key)
    if (hit) return hit
  }
  return null
}

interface Props {
  open: boolean
  satanicZone: string | null
  onClose: () => void
}

export function SzDropsPanel({ open, satanicZone, onClose }: Props) {
  const target = useMemo(() => resolveSatanicDrops(satanicZone), [satanicZone])

  if (!open) return null

  const title = target?.name || (satanicZone ? zoneLabel(satanicZone) : 'Satanic Zone')
  const drops = (target?.drops || []) as (DropItem & { inferno?: boolean })[]

  return (
    <aside className="sz-drops" role="dialog" aria-label="Drops da Satanic Zone" data-overlay-hit>
      <header className="sz-drops__head">
        <div>
          <p className="eyebrow">SZ drops</p>
          <h2>{title}</h2>
          {satanicZone ? <p className="sz-drops__sub">{satanicZone}</p> : null}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>
      <div className="sz-drops__body">
        {!satanicZone ? (
          <p className="muted">Satanic Zone ainda não anunciada.</p>
        ) : !target ? (
          <p className="muted">Zona não mapeada: {satanicZone}</p>
        ) : drops.length === 0 ? (
          <p className="muted">Sem drops direcionados nesta SZ.</p>
        ) : (
          <ul className="drop-list">
            {drops.map((d) => (
              <li key={d.key + String(d.inferno ?? '')} className="drop-row">
                <div className="drop-row__info">
                  <span className={`drop-name ${rarityClass(d.rarity)}`}>
                    {formatDropName(d.name, d.tier)}
                  </span>
                  <span className="drop-meta">
                    <DropOdds rate={d.rate} chase={d.chase} />
                    {d.inferno ? ' · Inferno' : ''}
                  </span>
                </div>
                <ItemIcon icon={d.icon} sheet={sheet} box={30} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
