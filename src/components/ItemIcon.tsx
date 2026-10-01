/** Icon crop box from the items sprite sheet: [x, y, w, h] */
export type IconBox = [number, number, number, number]

interface Props {
  icon: IconBox | null | undefined
  sheet: { w: number; h: number }
  box?: number
  src?: string
}

export function ItemIcon({ icon, sheet, box = 28, src = '/img/items.webp' }: Props) {
  if (!icon) {
    return <span className="item-icon item-icon--empty" style={{ width: box, height: box }} />
  }

  const [x, y, w, h] = icon
  const scale = Math.min(1, box / Math.max(w, h))

  return (
    <span className="item-icon" style={{ width: box, height: box }}>
      <span
        className="item-icon__art"
        style={{
          width: w,
          height: h,
          backgroundImage: `url(${src})`,
          backgroundPosition: `${-x}px ${-y}px`,
          backgroundSize: `${sheet.w}px ${sheet.h}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      />
    </span>
  )
}
