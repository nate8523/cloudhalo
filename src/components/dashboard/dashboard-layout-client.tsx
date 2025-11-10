'use client'

import { useState, useEffect } from 'react'
import { DashboardSidebar } from './sidebar'
import { cn } from '@/lib/utils'

interface DashboardLayoutClientProps {
  children: React.ReactNode
}

/**
 * Client-side wrapper for dashboard layout that manages responsive padding
 * based on sidebar collapse state
 */
export function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load initial state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cloudhalo-sidebar-collapsed')
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
    setIsHydrated(true)
  }, [])

  const handleCollapseChange = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
  }

  // Prevent hydration mismatch by using consistent initial state
  const collapsed = isHydrated ? isCollapsed : false

  return (
    <>
      <DashboardSidebar onCollapseChange={handleCollapseChange} />
      <div
        className={cn(
          "bg-background transition-all duration-300 ease-in-out",
          collapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <main className="min-h-screen p-6 bg-background">
          {children}
        </main>
      </div>
    </>
  )
}
