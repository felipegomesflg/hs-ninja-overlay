/** Icon crop box from the items sprite sheet: [x, y, w, h] */
export type IconBox = [number, number, number, number]

/** Relativo ao index.html — funciona no Vite e no Electron (file://). */
const DEFAULT_SHEET = `${import.meta.env.BASE_URL}img/items.webp`

interface Props {
  icon: IconBox | null | undefined
  sheet: { w: number; h: number }
  box?: number
  src?: string
}

export function ItemIcon({ icon, sheet, box = 28, src = DEFAULT_SHEET }: Props) {
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
          backgroundImage: `url(${JSON.stringify(src)})`,
          backgroundPosition: `${-x}px ${-y}px`,
          backgroundSize: `${sheet.w}px ${sheet.h}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      />
    </span>
  )
}
