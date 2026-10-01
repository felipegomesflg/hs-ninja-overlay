import { formatOdds, zoneOdds } from '../lib/mods'

/** Ex.: `1 in 126k / 1 in 397k (General drop)` — geral em vermelho. */
export function DropOdds({
  rate,
  chase,
}: {
  rate?: number | null
  chase?: number | null
}) {
  const zone = zoneOdds({ rate, chase })
  const general = rate != null && rate > 0 ? rate : null
  const showGeneral = general != null && zone != null && general !== zone

  return (
    <span className="drop-odds">
      <span className="drop-odds__zone">{formatOdds(zone)}</span>
      {showGeneral ? (
        <>
          {' / '}
          <span className="drop-odds__general">
            {formatOdds(general)} (General drop)
          </span>
        </>
      ) : null}
    </span>
  )
}
