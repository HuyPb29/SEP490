import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installVietnameseValidation } from './utils/vietnameseValidation'

const stopVietnameseValidation = installVietnameseValidation()
if (import.meta.hot) import.meta.hot.dispose(stopVietnameseValidation)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
