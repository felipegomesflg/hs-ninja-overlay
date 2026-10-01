/** Ícone de moeda / loot da Satanic Zone */
export function MoneyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="6.25" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
      <path
        d="M12 7.5v9M9.6 9.2c.55-.7 1.4-1.1 2.4-1.1 1.55 0 2.6.85 2.6 2.05 0 1.05-.7 1.7-2.35 2.15l-1.3.35c-1.15.3-1.7.75-1.7 1.55 0 .95.9 1.65 2.35 1.65 1.05 0 1.9-.4 2.45-1.05"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
