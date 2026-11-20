import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export function useNavigationDrawer() {
  const location = useLocation()
  const [openedAt, setOpenedAt] = useState(null)
  const open = openedAt === location
  useEffect(() => {
    if (!open) return undefined
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpenedAt(null)
    }
    desktop.addEventListener('change', closeOnDesktop)
    closeOnDesktop()
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [open])
  return [open, (next) => setOpenedAt(next ? location : null)]
}
