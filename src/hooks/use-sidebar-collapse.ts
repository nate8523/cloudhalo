'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cloudhalo-sidebar-collapsed'

/**
 * Custom hook to manage sidebar collapse state with localStorage persistence
 * @returns {Object} Object containing isCollapsed state and toggle function
 */
export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load initial state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
    setIsHydrated(true)
  }, [])

  // Persist state changes to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed))
    }
  }, [isCollapsed, isHydrated])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev)
  }

  return {
    isCollapsed,
    toggleCollapse,
    isHydrated, // Useful for preventing hydration mismatches
  }
}
