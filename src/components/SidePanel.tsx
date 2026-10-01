import { useEffect, useMemo, useRef, useState } from 'react'
import dropsData from '../data/drops.json'
import { formatDropName, rarityClass } from '../lib/rarity'
import { resolveTarget, type TargetContext } from '../lib/resolveTarget'
import type { AreaInfo, DropItem } from '../types'
import { DropOdds } from './DropOdds'
import { ItemIcon } from './ItemIcon'

const items = dropsData.items as DropItem[]
const areas = dropsData.areas as AreaInfo[]
const sheet = (dropsData as { sheet?: { w: number; h: number } }).sheet ?? { w: 1024, h: 3506 }

type SearchTab = 'item' | 'area'

function DropRows({
  drops,
}: {
  drops: (DropItem & { inferno?: boolean })[]
}) {
  return (
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
  )
}

interface Props {
  open: boolean
  onClose: () => void
  playerArea: string | null
  mode: 'drops' | 'search'
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

export function SidePanel({
  open,
  onClose,
  playerArea,
  mode,
  onRefresh,
  refreshing = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [searchTab, setSearchTab] = useState<SearchTab>('item')
  const [pickedArea, setPickedArea] = useState<AreaInfo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastTargetRef = useRef<TargetContext>(null)
  const [stale, setStale] = useState(false)

  const resolved = useMemo(() => resolveTarget(playerArea), [playerArea])

  useEffect(() => {
    if (resolved) {
      lastTargetRef.current = resolved
      setStale(false)
    } else if (lastTargetRef.current) {
      setStale(true)
    }
  }, [resolved])

  const target = resolved ?? lastTargetRef.current

  // Foca o input ao abrir / trocar aba — sem stealFocus em loop (isso engolia teclas).
  useEffect(() => {
    if (!open || mode !== 'search' || pickedArea) return
    const t = window.setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      try {
        window.hsOverlay?.stealFocusSync?.()
      } catch {
        /* ignore */
      }
      el.focus({ preventScroll: true })
    }, 40)
    return () => window.clearTimeout(t)
  }, [open, mode, searchTab, pickedArea])


  const itemResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items
      .filter((it) => it.name.toLowerCase().includes(q) || it.key.includes(q))
      .slice(0, 80)
  }, [query])

  const areaResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = areas.filter((a) => a.kind !== 'town' || (a.drops?.length ?? 0) > 0)
    if (!q) {
      return list
        .filter((a) => (a.drops?.length ?? 0) > 0 || a.boss)
        .slice(0, 60)
    }
    return list
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.room.toLowerCase().includes(q) ||
          (a.code && a.code.toLowerCase().includes(q)) ||
          (a.boss && a.boss.toLowerCase().includes(q)),
      )
      .slice(0, 80)
  }, [query])

  const areaDropsTarget = useMemo(() => {
    if (!pickedArea) return null
    return resolveTarget(pickedArea.room) ?? {
      kind: 'area' as const,
      id: pickedArea.room,
      name: pickedArea.name,
      room: pickedArea.room,
      roomLabel: pickedArea.name,
      drops: pickedArea.drops,
    }
  }, [pickedArea])

  if (!open) return null

  const dropsTitle =
    target?.kind === 'boss'
      ? target.name
      : target?.kind === 'area'
        ? target.name
        : 'Área atual'

  const dropsEyebrow = target?.kind === 'boss' ? 'Boss drops' : 'Target drops'

  const searchTitle =
    searchTab === 'area'
      ? pickedArea
        ? pickedArea.name
        : 'Buscar área'
      : 'Buscar item'

  return (
    <aside className="side-panel" role="dialog" aria-label="Painel" data-overlay-hit>
      <header className="side-panel__head">
        <div className="side-panel__titles">
          <p className="eyebrow">
            {mode === 'drops' ? dropsEyebrow : pickedArea ? 'Drops da área' : 'Busca'}
          </p>
          <div className="side-panel__title-row">
            <h2>{mode === 'drops' ? dropsTitle : searchTitle}</h2>
            {mode === 'drops' && onRefresh ? (
              <button
                type="button"
                className={`sz-chip__refresh ${refreshing ? 'spin' : ''}`}
                onClick={() => void onRefresh()}
                aria-label="Atualizar sala e drops"
                title="Atualizar agora"
              >
                ↻
              </button>
            ) : null}
          </div>
          {mode === 'drops' && target?.kind === 'boss' ? (
            <p className="side-panel__sub">{target.roomLabel}</p>
          ) : null}
          {mode === 'drops' && stale && target ? (
            <p className="side-panel__sub">Última sala conhecida · {target.roomLabel}</p>
          ) : null}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      {mode === 'drops' ? (
        <div className="side-panel__body">
          {!target ? (
            <p className="muted">Sem sala mapeada ainda — entre numa zona ou clique em ↻.</p>
          ) : target.drops.length === 0 ? (
            <p className="muted">
              {target.kind === 'boss' ? 'Este boss' : 'Esta área'} não tem drops direcionados no map.
            </p>
          ) : (
            <DropRows drops={target.drops} />
          )}
        </div>
      ) : (
        <div className="side-panel__body">
          {pickedArea ? (
            <>
              <button
                type="button"
                className="link-back"
                onClick={() => setPickedArea(null)}
              >
                ← Voltar às áreas
              </button>
              {!areaDropsTarget || areaDropsTarget.drops.length === 0 ? (
                <p className="muted">Esta área não tem drops direcionados no map.</p>
              ) : (
                <DropRows drops={areaDropsTarget.drops} />
              )}
            </>
          ) : (
            <>
              <div className="search-tabs" role="tablist" aria-label="Tipo de busca">
                <button
                  type="button"
                  role="tab"
                  aria-selected={searchTab === 'item'}
                  className={`search-tab ${searchTab === 'item' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchTab('item')
                    setQuery('')
                  }}
                >
                  Item
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={searchTab === 'area'}
                  className={`search-tab ${searchTab === 'area' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchTab('area')
                    setQuery('')
                  }}
                >
                  Área
                </button>
              </div>

              <input
                ref={inputRef}
                className="search-input"
                type="text"
                tabIndex={0}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  // Só rouba foco OS se o input ainda não está ativo
                  if (document.activeElement === inputRef.current) return
                  try {
                    window.hsOverlay?.stealFocusSync?.()
                  } catch {
                    /* ignore */
                  }
                }}
                placeholder={
                  searchTab === 'item' ? 'Nome do item…' : 'Nome da área / Act_09_05…'
                }
              />

              {searchTab === 'item' ? (
                !query.trim() ? (
                  <p className="muted">Busque um item para ver onde farmar.</p>
                ) : itemResults.length === 0 ? (
                  <p className="muted">Nada encontrado.</p>
                ) : (
                  <ul className="drop-list">
                    {itemResults.map((it) => (
                      <li key={it.key} className="drop-row">
                        <div className="drop-row__info">
                          <span className={`drop-name ${rarityClass(it.rarity)}`}>
                            {formatDropName(it.name, it.tier)}
                          </span>
                          <span className="drop-meta">
                            <DropOdds rate={it.rate} chase={it.chase} />
                          </span>
                          <span className="drop-places">
                            {it.places?.length
                              ? it.places.join(' · ')
                              : it.hasArea
                                ? (it.zones || []).join(', ')
                                : 'Sem área específica'}
                          </span>
                        </div>
                        <ItemIcon icon={it.icon} sheet={sheet} box={30} />
                      </li>
                    ))}
                  </ul>
                )
              ) : areaResults.length === 0 ? (
                <p className="muted">Nenhuma área encontrada.</p>
              ) : (
                <ul className="area-list">
                  {areaResults.map((a) => (
                    <li key={a.room}>
                      <button
                        type="button"
                        className="area-row"
                        onClick={() => setPickedArea(a)}
                      >
                        <span className="area-row__name">{a.name}</span>
                        <span className="area-row__meta">
                          {a.code || a.room}
                          {a.boss ? ` · ${a.boss}` : ''}
                          {` · ${a.drops?.length ?? 0} drops`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  )
}
