import { buffIcon, getBuff, getDebuff, roomLabel, zoneLabel } from '../lib/mods'
import type { SatanicZoneState } from '../types'
import { MoneyIcon } from './MoneyIcon'

interface Props {
  zone: SatanicZoneState
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
  szDropsOpen?: boolean
  onToggleSzDrops?: () => void
  /** Mostra aviso se Npcap não estiver instalado */
  npcapMissing?: boolean
  onNpcapWarning?: () => void | Promise<void>
}

export function SatanicBar({
  zone,
  onRefresh,
  refreshing = false,
  szDropsOpen = false,
  onToggleSzDrops,
  npcapMissing = false,
  onNpcapWarning,
}: Props) {
  const buffs = (zone.buffs || []).map((id) => {
    const info = getBuff(id)
    return { ...info, icon: buffIcon(id) }
  })
  const debuffs = (zone.debuffs || []).map((id) => getDebuff(id))

  const hasSz = Boolean(zone.zone)
  const titleLine = hasSz
    ? zoneLabel(zone.zone)
    : zone.satanicHere
      ? zone.area
        ? `Na SZ · ${roomLabel(zone.area)}`
        : 'Dentro da Satanic Zone'
      : zone.area
        ? 'SZ ainda não anunciada'
        : zone.ok
          ? 'Aguardando Satanic Zone…'
          : zone.error || 'Captura offline'

  const title = [
    hasSz ? `SZ: ${zone.zone}` : 'SZ: —',
    zone.area ? `sala: ${zone.area} (${roomLabel(zone.area)})` : 'sala: —',
    zone.path ? `arquivo: ${zone.path}` : null,
    !zone.ok && zone.error ? zone.error : null,
    npcapMissing ? 'Npcap não instalado — captura ao vivo indisponível' : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className={`sz-chip ${hasSz ? '' : 'sz-chip--waiting'}`.trim()} title={title}>
      <div className="sz-chip__text">
        <div className="sz-chip__title-row">
          <span className="sz-chip__name">{titleLine}</span>
          {npcapMissing ? (
            <button
              type="button"
              className="sz-chip__npcap-warn"
              onClick={(e) => {
                e.stopPropagation()
                void onNpcapWarning?.()
              }}
              aria-label="Npcap não instalado — clique para baixar"
              title="Npcap não encontrado. Clique para abrir npcap.com"
            >
              ⚠
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              className={`sz-chip__refresh ${refreshing ? 'spin' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                void onRefresh()
              }}
              aria-label="Atualizar sala e Satanic Zone"
              title="Atualizar agora"
            >
              ↻
            </button>
          ) : null}
        </div>
        {hasSz ? <span className="sz-chip__code">{zone.zone}</span> : null}
        {zone.area ? <span className="sz-chip__area">{roomLabel(zone.area)}</span> : null}
      </div>

      <div className="sz-chip__mods" aria-label="Mods da Satanic Zone">
        {buffs.map((b) => (
          <div key={`b-${b.id}`} className="mod-icon good" tabIndex={0}>
            <img src={b.icon} alt={b.name} />
            <div className="tooltip">
              <strong>{b.name}</strong>
              <p>{b.desc}</p>
            </div>
          </div>
        ))}

        {buffs.length > 0 && debuffs.length > 0 ? <span className="sz-chip__sep" /> : null}

        {debuffs.map((d) => (
          <div key={`d-${d.id}`} className="mod-icon bad" tabIndex={0}>
            <span className="debuff-glyph">{d.id}</span>
            <div className="tooltip">
              <strong>{d.name}</strong>
              <p>{d.desc}</p>
            </div>
          </div>
        ))}

        {hasSz && buffs.length === 0 && debuffs.length === 0 ? (
          <span className="sz-chip__empty">sem mods</span>
        ) : null}
        {!hasSz ? <span className="sz-chip__empty">mods quando a SZ girar</span> : null}
      </div>

      {onToggleSzDrops ? (
        <button
          type="button"
          className={`sz-chip__loot ${szDropsOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSzDrops()
          }}
          aria-label="Drops da Satanic Zone"
          title={hasSz ? 'Drops desta Satanic Zone' : 'Aguardando Satanic Zone'}
          disabled={!hasSz}
        >
          <MoneyIcon size={15} />
        </button>
      ) : null}
    </div>
  )
}
