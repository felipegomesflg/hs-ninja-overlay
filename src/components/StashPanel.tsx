import dropsData from '../data/drops.json'
import { buffIcon } from '../lib/mods'
import { formatDropName, rarityClass, tierGrade } from '../lib/rarity'
import type { DropItem, DropJournalEntry } from '../types'
import { ItemIcon } from './ItemIcon'

const catalog = dropsData.items as DropItem[]
const sheet = (dropsData as { sheet?: { w: number; h: number } }).sheet ?? { w: 1024, h: 3506 }

const byName = (() => {
  const map = new Map<string, DropItem>()
  for (const item of catalog) {
    map.set(item.name.toLowerCase(), item)
  }
  return map
})()

function resolveIcon(entry: DropJournalEntry) {
  return byName.get(entry.name.toLowerCase())?.icon ?? null
}

function resolveRarity(entry: DropJournalEntry) {
  return entry.rarity || byName.get(entry.name.toLowerCase())?.rarity || null
}

function resolveTier(entry: DropJournalEntry) {
  if (entry.tier != null && entry.tier > 0) return entry.tier
  return byName.get(entry.name.toLowerCase())?.tier ?? null
}

interface Props {
  open: boolean
  mf: number | null | undefined
  drops: DropJournalEntry[]
  onClose: () => void
}

export function StashPanel({ open, mf, drops, onClose }: Props) {
  if (!open) return null

  const mfLabel = mf != null && Number.isFinite(mf) ? String(mf) : '—'

  return (
    <aside className="side-panel side-panel--stash" aria-label="Histórico de drops">
      <header className="side-panel__head stash-head">
        <div className="stash-mf">
          <img className="stash-mf__icon" src={buffIcon(4)} alt="" width={22} height={22} />
          <span className="stash-mf__label">
            MF : <strong>{mfLabel}</strong>
          </span>
        </div>
        <button type="button" className="side-panel__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      <div className="side-panel__body stash-body">
        {drops.length === 0 ? (
          <p className="stash-empty">Nenhum drop registrado ainda.</p>
        ) : (
          <ul className="drop-list stash-list">
            {drops.map((d) => {
              const rarity = resolveRarity(d)
              const tier = resolveTier(d)
              const grade = tierGrade(tier)
              return (
                <li key={d.id} className="drop-row stash-row">
                  <div className="drop-row__info">
                    <span className={`drop-name ${rarityClass(rarity)}`}>
                      {formatDropName(d.name, tier)}
                    </span>
                    <span className="drop-meta">
                      {[grade, rarity].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <ItemIcon icon={resolveIcon(d)} sheet={sheet} box={30} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
