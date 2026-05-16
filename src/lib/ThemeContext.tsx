import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getSetting, setSetting } from './db'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth()
  const [theme, setThemeState] = useState<Theme>('light')
  const [initialized, setInitialized] = useState(false)

  // Load theme from localStorage first, then Supabase if logged in
  useEffect(() => {
    const savedTheme = localStorage.getItem('refract-theme') as Theme | null
    if (savedTheme) {
      setThemeState(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const initialTheme = prefersDark ? 'dark' : 'light'
      setThemeState(initialTheme)
      document.documentElement.setAttribute('data-theme', initialTheme)
    }
    setInitialized(true)
  }, [])

  // Load theme from Supabase when profile is available
  useEffect(() => {
    if (!initialized || !profile?.id) return

    const loadTheme = async () => {
      try {
        const saved = await getSetting('theme', '')
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved)
          document.documentElement.setAttribute('data-theme', saved)
          localStorage.setItem('refract-theme', saved)
        }
      } catch (err) {
        console.warn('[theme] failed to load theme from Supabase:', err)
      }
    }
    loadTheme()
  }, [profile?.id, initialized])

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('refract-theme', newTheme)

    if (profile?.id) {
      try {
        await setSetting('theme', newTheme)
      } catch (err) {
        console.warn('[theme] failed to save theme to Supabase:', err)
      }
    }
  }, [profile?.id])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
