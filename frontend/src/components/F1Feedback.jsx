import { useEffect, useRef } from 'react'

export function F1Dialog({ message, onClose, onConfirm, title }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  return <dialog ref={ref} aria-label={title || 'Thông báo'} className="m-auto max-w-md rounded-xl bg-white p-6 shadow-xl backdrop:bg-black/40"
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    {title && <h2 className="mb-2 font-semibold">{title}</h2>}
    <p>{message}</p>
    <button type="button" className="mt-4 rounded bg-emerald-800 px-4 py-2 text-white" onClick={onClose}>{onConfirm ? 'Hủy' : 'Đã hiểu'}</button>
    {onConfirm && <button type="button" className="ml-2 rounded bg-red-800 px-4 py-2 text-white" onClick={onConfirm}>Xác nhận</button>}
  </dialog>
}

export function F1Toast({ children }) {
  if (!children) return null
  return <p role="status" className="fixed right-4 top-4 z-[60] max-w-sm rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-950 shadow">
    {children}
  </p>
}
