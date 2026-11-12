import { useEffect, useState } from 'react'

export function usePackagePreview(request, load, revision) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!request) return undefined
    let active = true
    const timer = setTimeout(() => {
      load(request).then((value) => {
        if (active) setResult({ request, revision, data: value?.data ?? value })
      }).catch((error) => {
        if (active) setResult({ request, revision, error: error.response?.data?.message || error.message || 'Không tải được lịch gói.' })
      })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [request, load, revision])
  return result?.request === request && result.revision === revision ? result : null
}
