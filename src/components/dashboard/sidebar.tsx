'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Cloud,
  DollarSign,
  Bell,
  TrendingDown,
  Settings,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useSidebarCollapse } from '@/hooks/use-sidebar-collapse'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tenants', href: '/dashboard/tenants', icon: Cloud },
  { name: 'Costs', href: '/dashboard/costs', icon: DollarSign },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
  { name: 'Optimization', href: '/dashboard/optimization', icon: TrendingDown },
]

interface DashboardSidebarProps {
  onCollapseChange?: (isCollapsed: boolean) => void
}

export function DashboardSidebar({ onCollapseChange }: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isCollapsed, toggleCollapse, isHydrated } = useSidebarCollapse()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleToggle = () => {
    toggleCollapse()
    if (onCollapseChange) {
      onCollapseChange(!isCollapsed)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Prevent hydration mismatch by rendering consistent initial state
  const collapsed = isHydrated ? isCollapsed : false

  return (
    <div
      className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out",
        collapsed ? "lg:w-20" : "lg:w-64"
      )}
    >
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gradient-to-b from-[#0078D4] to-[#004578] px-6 pb-4 relative shadow-[var(--shadow-16dp)]">
        {/* Collapse/Expand Toggle Button */}
        <button
          onClick={handleToggle}
          className="absolute top-4 right-2 z-10 p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Logo/Brand */}
        <div className="flex h-16 shrink-0 items-center">
          <Cloud className="h-8 w-8 text-white shrink-0" />
          <span
            className={cn(
              "ml-2 text-xl font-bold text-white transition-all duration-300",
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            )}
          >
            CloudHalo
          </span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <Link href="/dashboard/tenants/new">
                <Button
                  className={cn(
                    "w-full bg-white hover:bg-white/90 text-primary font-semibold shadow-[var(--shadow-8dp)] hover:shadow-[var(--shadow-16dp)] transition-all",
                    collapsed && "px-2"
                  )}
                  size="sm"
                  title={collapsed ? "Add Tenant" : undefined}
                >
                  <Plus className={cn("h-4 w-4", !collapsed && "mr-2")} />
                  <span
                    className={cn(
                      "transition-all duration-300",
                      collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}
                  >
                    Add Tenant
                  </span>
                </Button>
              </Link>
            </li>
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-white/25 text-white font-semibold shadow-sm'
                            : 'text-white/90 hover:bg-white/15 hover:text-white',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-all',
                          collapsed && 'justify-center'
                        )}
                        title={collapsed ? item.name : undefined}
                        aria-label={item.name}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-white' : 'text-white/80',
                            'h-5 w-5 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "transition-all duration-300",
                            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                          )}
                        >
                          {item.name}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
            <li className="mt-auto">
              <Separator className="mb-4 bg-white/20" />
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={cn(
                  'group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-medium text-white/90 hover:bg-white/15 hover:text-white transition-all mb-2',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? (mounted && theme === 'dark' ? "Switch to light mode" : "Switch to dark mode") : undefined}
                aria-label={mounted && theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="h-5 w-5 shrink-0 text-white/80" aria-hidden="true" />
                ) : (
                  <Moon className="h-5 w-5 shrink-0 text-white/80" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "transition-all duration-300",
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  )}
                >
                  {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </button>
              <Link
                href="/dashboard/settings"
                className={cn(
                  pathname.startsWith('/dashboard/settings')
                    ? 'bg-white/25 text-white font-semibold shadow-sm'
                    : 'text-white/90 hover:bg-white/15 hover:text-white',
                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-all mb-2',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? "Settings" : undefined}
                aria-label="Settings"
              >
                <Settings
                  className={cn(
                    pathname.startsWith('/dashboard/settings') ? 'text-white' : 'text-white/80',
                    'h-5 w-5 shrink-0'
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "transition-all duration-300",
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  )}
                >
                  Settings
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className={cn(
                  "group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-medium text-white/90 hover:bg-white/15 hover:text-white transition-all mb-4",
                  collapsed && 'justify-center'
                )}
                title={collapsed ? "Sign out" : undefined}
                aria-label="Sign out"
              >
                <LogOut
                  className="h-5 w-5 shrink-0 text-white/80"
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "transition-all duration-300",
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  )}
                >
                  Sign Out
                </span>
              </button>
              <div
                className={cn(
                  "text-xs text-white/60 transition-all duration-300",
                  collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
                )}
              >
                <p>Version 0.1.0 (MVP)</p>
                <p className="mt-1">© 2025 CloudHalo</p>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
