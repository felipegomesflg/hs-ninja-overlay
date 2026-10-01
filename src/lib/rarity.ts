/** Grade do item: 1=D … 6=SS (igual hs-tracker). */
const TIER_GRADES = ['', 'D', 'C', 'B', 'A', 'S', 'SS'] as const

export function tierGrade(tier: number | null | undefined): string | null {
  if (tier == null || !Number.isFinite(Number(tier))) return null
  const t = Math.trunc(Number(tier))
  if (t >= 1 && t <= 6) return TIER_GRADES[t]
  return null
}

export function rarityClass(rarity: string | null | undefined): string {
  if (!rarity) return ''
  return `rarity-${String(rarity).toLowerCase().trim().replace(/\s+/g, '-')}`
}

/** Prefixo de grade no nome: `[SS] Azazel's Despair` */
export function formatDropName(name: string, tier?: number | null): string {
  const grade = tierGrade(tier)
  return grade ? `[${grade}] ${name}` : name
}
