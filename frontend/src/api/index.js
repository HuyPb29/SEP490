import axios from 'axios'
import { getAccessToken } from '../utils/authStorage'

// Attach Bearer token to all outgoing requests via global axios
axios.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

export default api
