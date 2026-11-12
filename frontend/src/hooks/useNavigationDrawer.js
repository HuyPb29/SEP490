import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export function useNavigationDrawer() {
  const location = useLocation()
  const [openedAt, setOpenedAt] = useState(null)
  const open = openedAt === location
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setOpenedAt(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return [open, (next) => setOpenedAt(next ? location : null)]
}
