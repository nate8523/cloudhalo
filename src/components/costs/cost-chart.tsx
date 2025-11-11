'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'

interface CostSnapshot {
  id: string
  date: string
  cost_usd: number
  service_category: string | null
  resource_name: string | null
}

interface CostChartProps {
  data: CostSnapshot[]
}

export function CostChart({ data }: CostChartProps) {
  const chartData = useMemo(() => {
    // Group costs by date
    const costsByDate = data.reduce((acc, record) => {
      const date = record.date
      if (!acc[date]) {
        acc[date] = 0
      }
      acc[date] += Number(record.cost_usd || 0)
      return acc
    }, {} as Record<string, number>)

    // Convert to array and sort by date
    return Object.entries(costsByDate)
      .map(([date, cost]) => ({
        date,
        cost: Number(cost.toFixed(2)),
        formattedDate: format(parseISO(date), 'MMM dd')
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No cost data available</p>
          <p className="text-xs mt-1">Try adjusting your filters or sync cost data</p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="formattedDate"
          className="text-xs"
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          className="text-xs"
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => `$${value.toLocaleString()}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            padding: '8px 12px'
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number) => [
            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'Cost'
          ]}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#costGradient)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
