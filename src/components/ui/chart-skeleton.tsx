'use client'

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ChartSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'line' | 'bar' | 'area' | 'donut'
  showGrid?: boolean
  showAxes?: boolean
  animated?: boolean
}

/**
 * ChartSkeleton - A loading placeholder for future chart components
 * Provides anticipatory loading states for data visualizations
 */
export function ChartSkeleton({
  variant = 'line',
  showGrid = true,
  showAxes = true,
  animated = true,
  className,
  ...props
}: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        "relative w-full h-full flex items-end justify-between p-6 bg-gradient-to-br from-muted/10 to-muted/5 rounded-lg overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Grid Background */}
      {showGrid && (
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 gap-px opacity-10">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className="border-r border-b border-border" />
          ))}
        </div>
      )}

      {/* Y-Axis */}
      {showAxes && (
        <div className="absolute left-2 top-6 bottom-6 flex flex-col justify-between items-end pr-2 text-xs text-muted-foreground/50 font-mono">
          {['100', '80', '60', '40', '20', '0'].map((value, i) => (
            <motion.span
              key={value}
              initial={animated ? { opacity: 0, x: -10 } : {}}
              animate={animated ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              {value}
            </motion.span>
          ))}
        </div>
      )}

      {/* Chart Content */}
      <div className={cn(
        "relative flex items-end justify-between gap-2 w-full h-full",
        showAxes && "pl-12 pb-8"
      )}>
        {variant === 'bar' && <BarChartSkeleton animated={animated} />}
        {variant === 'line' && <LineChartSkeleton animated={animated} />}
        {variant === 'area' && <AreaChartSkeleton animated={animated} />}
        {variant === 'donut' && <DonutChartSkeleton animated={animated} />}
      </div>

      {/* X-Axis */}
      {showAxes && variant !== 'donut' && (
        <div className="absolute bottom-2 left-12 right-6 flex justify-between text-xs text-muted-foreground/50 font-mono">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((label, i) => (
            <motion.span
              key={label}
              initial={animated ? { opacity: 0, y: 10 } : {}}
              animate={animated ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.05 + 0.2, duration: 0.3 }}
            >
              {label}
            </motion.span>
          ))}
        </div>
      )}

      {/* Shimmer Effect */}
      {animated && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      )}
    </div>
  )
}

function BarChartSkeleton({ animated }: { animated: boolean }) {
  const heights = [65, 45, 80, 55, 70, 50, 75, 60, 85, 55, 65, 70]

  return (
    <>
      {heights.map((height, i) => (
        <motion.div
          key={i}
          className="flex-1 bg-gradient-to-t from-primary/40 to-primary/20 rounded-t-sm"
          style={{ height: `${height}%` }}
          initial={animated ? { scaleY: 0, opacity: 0 } : {}}
          animate={animated ? { scaleY: 1, opacity: 1 } : {}}
          transition={{
            delay: i * 0.05,
            duration: 0.4,
            ease: "easeOut"
          }}
        />
      ))}
    </>
  )
}

function LineChartSkeleton({ animated }: { animated: boolean }) {
  const points = [
    { x: 8, y: 35 },
    { x: 16, y: 55 },
    { x: 25, y: 45 },
    { x: 33, y: 20 },
    { x: 41, y: 30 },
    { x: 50, y: 50 },
    { x: 58, y: 40 },
    { x: 66, y: 15 },
    { x: 75, y: 25 },
    { x: 83, y: 45 },
    { x: 91, y: 30 },
  ]

  const pathD = points.reduce((path, point, i) => {
    return path + (i === 0 ? `M ${point.x} ${100 - point.y}` : ` L ${point.x} ${100 - point.y}`)
  }, '')

  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <motion.path
        d={pathD}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.4"
        initial={animated ? { pathLength: 0, opacity: 0 } : {}}
        animate={animated ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      {points.map((point, i) => (
        <motion.circle
          key={i}
          cx={`${point.x}%`}
          cy={`${100 - point.y}%`}
          r="3"
          fill="hsl(var(--primary))"
          fillOpacity="0.6"
          initial={animated ? { scale: 0, opacity: 0 } : {}}
          animate={animated ? { scale: 1, opacity: 1 } : {}}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        />
      ))}
    </svg>
  )
}

function AreaChartSkeleton({ animated }: { animated: boolean }) {
  const points = [
    { x: 8, y: 35 },
    { x: 25, y: 55 },
    { x: 41, y: 45 },
    { x: 58, y: 70 },
    { x: 75, y: 50 },
    { x: 91, y: 65 },
  ]

  const pathD = points.reduce((path, point, i) => {
    return path + (i === 0 ? `M ${point.x} ${100 - point.y}` : ` L ${point.x} ${100 - point.y}`)
  }, '') + ' L 91 100 L 8 100 Z'

  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <motion.path
        d={pathD}
        fill="url(#areaGradient)"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.5"
        initial={animated ? { pathLength: 0, opacity: 0 } : {}}
        animate={animated ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
    </svg>
  )
}

function DonutChartSkeleton({ animated }: { animated: boolean }) {
  const segments = [
    { color: 'var(--primary)', percent: 35, offset: 0 },
    { color: 'var(--accent)', percent: 25, offset: 35 },
    { color: 'var(--success)', percent: 20, offset: 60 },
    { color: 'var(--warning)', percent: 20, offset: 80 },
  ]

  const radius = 40
  const strokeWidth = 12
  const center = 50

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="max-w-[200px] max-h-[200px]">
        {segments.map((segment, i) => {
          const circumference = 2 * Math.PI * radius
          const strokeDasharray = `${(segment.percent / 100) * circumference} ${circumference}`
          const rotation = (segment.offset / 100) * 360 - 90

          return (
            <motion.circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`hsl(${segment.color})`}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeOpacity="0.4"
              transform={`rotate(${rotation} ${center} ${center})`}
              initial={animated ? { strokeDashoffset: circumference, opacity: 0 } : {}}
              animate={animated ? { strokeDashoffset: 0, opacity: 1 } : {}}
              transition={{ delay: i * 0.2, duration: 0.8, ease: "easeOut" }}
            />
          )
        })}
      </svg>
    </div>
  )
}
