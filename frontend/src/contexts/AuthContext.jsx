import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getStoredUser, getAccessToken, saveAuthSession, clearAuthStorage } from '../utils/authStorage'
import { AuthContext } from './authContextDef'

export function AuthProvider({ children }) {
  // Synchronous lazy initializer avoids F5 reset to null and avoids set-state-in-effect warning
  const [user, setUser] = useState(() => getStoredUser())
  const [isLoading] = useState(false)

  // Synchronize across tabs and storage events
  useEffect(() => {
    const handleAuthChange = () => {
      setUser(getStoredUser())
    }
    window.addEventListener('bms-auth-change', handleAuthChange)
    window.addEventListener('storage', handleAuthChange)
    return () => {
      window.removeEventListener('bms-auth-change', handleAuthChange)
      window.removeEventListener('storage', handleAuthChange)
    }
  }, [])

  const login = useCallback((accessToken, userData, refreshToken = null) => {
    saveAuthSession(accessToken, userData, refreshToken)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    clearAuthStorage()
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...updatedData }
      saveAuthSession(getAccessToken(), nextUser)
      return nextUser
    })
  }, [])

  const value = useMemo(() => {
    const token = getAccessToken()
    const isAuthenticated = !!(user || token)
    const role = String(user?.role_code || user?.role || '').toUpperCase()

    return {
      user,
      token,
      isAuthenticated,
      role,
      isLoading,
      login,
      logout,
      updateUser,
    }
  }, [user, isLoading, login, logout, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
