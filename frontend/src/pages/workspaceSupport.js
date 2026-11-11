import { useEffect, useState } from 'react'

export const money = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
export const errorMessage = (error) => error.response?.data?.message || 'Không thể hoàn thành thao tác. Vui lòng thử lại.'

export function useResource(load, key) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ key, revision, data }) })
      .catch((error) => { if (!controller.signal.aborted) setState({ key, revision, error: errorMessage(error) }) })
    return () => controller.abort()
  }, [load, key, revision])
  const current = state?.key === key && state?.revision === revision ? state : null
  return { ...current, loading: !current, reload: () => setRevision((value) => value + 1) }
}
