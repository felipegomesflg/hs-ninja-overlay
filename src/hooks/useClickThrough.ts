import { useEffect, useRef } from 'react'

/**
 * Click-through: fora de `[data-overlay-hit]` o mouse vai para o jogo.
 * Nunca trava a tela inteira — senão o jogo fica inclicável com a busca aberta.
 */
export function useClickThrough() {
  const ignoring = useRef<boolean | null>(null)

  useEffect(() => {
    const api = window.hsOverlay
    if (!api?.setMouseIgnore) return

    const setIgnore = (next: boolean) => {
      if (ignoring.current === next) return
      ignoring.current = next
      void api.setMouseIgnore(next)
    }

    setIgnore(true)

    const onMove = (event: MouseEvent) => {
      const el = document.elementFromPoint(event.clientX, event.clientY)
      const hit = Boolean(el?.closest('[data-overlay-hit]'))
      setIgnore(!hit)
    }

    const onLeave = () => setIgnore(true)

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      setIgnore(true)
    }
  }, [])
}
