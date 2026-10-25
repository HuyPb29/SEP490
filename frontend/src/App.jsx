import { useEffect, useState } from 'react'
import api from './api'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('backend offline'))
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-2 bg-slate-50">
      <h1 className="text-3xl font-bold text-slate-800">SEP490 - BMS</h1>
      <p className="text-slate-600">Backend: {status}</p>
    </main>
  )
}
