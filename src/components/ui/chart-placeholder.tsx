'use client'

import * as React from "react"
import { motion } from "framer-motion"
import { TrendingUp, BarChart3, PieChart, LineChart } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChartPlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: 'line' | 'bar' | 'pie' | 'trend'
  animated?: boolean
}

const iconMap = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  trend: TrendingUp,
}

/**
 * ChartPlaceholder - Empty state for charts
 * Used when no data is available or during initial load
 */
export function ChartPlaceholder({
  title = "No data available",
  description = "Connect a tenant to see analytics",
  icon = 'trend',
  animated = true,
  className,
  ...props
}: ChartPlaceholderProps) {
  const Icon = iconMap[icon]

  const content = (
    <>
      {/* Animated Icon Background */}
      <div className="relative">
        {/* Outer Ring */}
        {animated ? (
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.3, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ) : (
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-xl opacity-50" />
        )}

        {/* Icon Container */}
        <div className="relative rounded-full bg-gradient-to-br from-primary/20 to-accent/10 p-5 w-20 h-20 flex items-center justify-center shadow-lg">
          <Icon className="h-10 w-10 text-primary" />
        </div>
      </div>

      {/* Text Content */}
      <div className="space-y-2 max-w-md">
        <h3 className="text-body-lg font-semibold text-foreground">{title}</h3>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        {/* Grid Pattern */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Floating Dots */}
        {animated && [1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/30"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 2) * 20}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2 + i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </>
  )

  if (animated) {
    return (
      <motion.div
        className={cn(
          "flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4 p-8",
          className
        )}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        {...(props as any)}
      >
        {content}
      </motion.div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4 p-8",
        className
      )}
      {...props}
    >
      {content}
    </div>
  )
}

/**
 * ChartLoadingState - Loading state with pulsing skeleton
 */
export function ChartLoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center h-full min-h-[300px]", className)}>
      <div className="space-y-4 w-full max-w-md">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
          <div className="h-4 bg-muted rounded w-1/6 animate-pulse" />
        </div>
        <div className="h-48 bg-gradient-to-br from-muted/50 to-muted/20 rounded-lg animate-pulse relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
        <div className="flex gap-4">
          <div className="h-3 bg-muted rounded flex-1 animate-pulse" />
          <div className="h-3 bg-muted rounded flex-1 animate-pulse" />
          <div className="h-3 bg-muted rounded flex-1 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
