'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CostSnapshot {
  id: string
  date: string
  cost_usd: number
  service_category: string | null
  resource_name: string | null
  location: string | null
}

interface CostBreakdownProps {
  data: CostSnapshot[]
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#6366f1'
]

export function CostBreakdown({ data }: CostBreakdownProps) {
  const serviceData = useMemo(() => {
    const costsByService = data.reduce((acc, record) => {
      const service = record.service_category || 'Uncategorized'
      if (!acc[service]) {
        acc[service] = 0
      }
      acc[service] += Number(record.cost_usd || 0)
      return acc
    }, {} as Record<string, number>)

    return Object.entries(costsByService)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 services
  }, [data])

  const locationData = useMemo(() => {
    const costsByLocation = data.reduce((acc, record) => {
      const location = record.location || 'Unknown'
      if (!acc[location]) {
        acc[location] = 0
      }
      acc[location] += Number(record.cost_usd || 0)
      return acc
    }, {} as Record<string, number>)

    return Object.entries(costsByLocation)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 locations
  }, [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <>
      {/* Cost by Service */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-body-lg text-foreground">Cost by Service</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            Top 10 Azure services by spend
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          {serviceData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm">No service data available</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    percent && percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={1000}
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => (
                    <span className="text-xs text-muted-foreground">
                      {value} - ${entry.payload.value.toLocaleString()}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cost by Location */}
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-body-lg text-foreground">Cost by Location</CardTitle>
          <CardDescription className="text-body-sm text-muted-foreground">
            Top 10 Azure regions by spend
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          {locationData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm">No location data available</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={locationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    percent && percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={1000}
                >
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => (
                    <span className="text-xs text-muted-foreground">
                      {value} - ${entry.payload.value.toLocaleString()}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  )
}
