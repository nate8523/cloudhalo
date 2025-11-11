'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Bell,
  DollarSign,
  TrendingUp,
  Wallet,
  AlertTriangle,
  MoreVertical,
  Pause,
  Play,
  Trash2,
  Edit,
} from 'lucide-react'

interface AlertRule {
  id: string
  name: string
  type: string
  threshold_amount: number | null
  threshold_percent: number | null
  status: string
  created_at: string
  azure_tenants?: {
    name: string
  }
}

interface AlertRuleListProps {
  alertRules: AlertRule[]
  onEdit?: (ruleId: string) => void
  onToggleStatus?: (ruleId: string, newStatus: string) => Promise<void>
  onDelete?: (ruleId: string) => Promise<void>
}

export function AlertRuleList({
  alertRules,
  onEdit,
  onToggleStatus,
  onDelete,
}: AlertRuleListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'PERCENTAGE_SPIKE':
        return {
          icon: TrendingUp,
          label: 'Percentage Spike',
          color: 'text-orange-600',
          bg: 'bg-orange-100 dark:bg-orange-950',
        }
      case 'THRESHOLD':
        return {
          icon: DollarSign,
          label: 'Cost Threshold',
          color: 'text-blue-600',
          bg: 'bg-blue-100 dark:bg-blue-950',
        }
      case 'BUDGET':
        return {
          icon: Wallet,
          label: 'Budget Alert',
          color: 'text-green-600',
          bg: 'bg-green-100 dark:bg-green-950',
        }
      case 'ANOMALY':
        return {
          icon: AlertTriangle,
          label: 'Anomaly Detection',
          color: 'text-red-600',
          bg: 'bg-red-100 dark:bg-red-950',
        }
      default:
        return {
          icon: Bell,
          label: type,
          color: 'text-gray-600',
          bg: 'bg-gray-100 dark:bg-gray-950',
        }
    }
  }

  const handleToggleStatus = async (ruleId: string, currentStatus: string) => {
    if (!onToggleStatus) return
    setLoadingId(ruleId)
    setActionMenuOpen(null)
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active'
      await onToggleStatus(ruleId, newStatus)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!onDelete) return
    if (!confirm('Are you sure you want to delete this alert rule?')) return

    setLoadingId(ruleId)
    setActionMenuOpen(null)
    try {
      await onDelete(ruleId)
    } finally {
      setLoadingId(null)
    }
  }

  if (!alertRules || alertRules.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Alert Rules</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          You haven't created any alert rules yet. Create your first alert rule to start monitoring
          Azure costs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alertRules.map((rule) => {
        const typeConfig = getTypeConfig(rule.type)
        const TypeIcon = typeConfig.icon
        const isLoading = loadingId === rule.id

        return (
          <Card key={rule.id} variant="glassmorphism">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {/* Icon */}
                  <div className={`rounded-lg p-2 ${typeConfig.bg}`}>
                    <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{rule.name}</h4>
                          <Badge
                            variant={rule.status === 'active' ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {rule.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{typeConfig.label}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                      <div>
                        <p className="font-medium mb-1">Tenant</p>
                        <p>{rule.azure_tenants?.name || 'Unknown'}</p>
                      </div>
                      {rule.threshold_amount !== null && (
                        <div>
                          <p className="font-medium mb-1">Threshold Amount</p>
                          <p className="font-mono">${rule.threshold_amount.toFixed(2)}</p>
                        </div>
                      )}
                      {rule.threshold_percent !== null && (
                        <div>
                          <p className="font-medium mb-1">Threshold Percent</p>
                          <p className="font-mono">{rule.threshold_percent}%</p>
                        </div>
                      )}
                      <div>
                        <p className="font-medium mb-1">Created</p>
                        <p>{new Date(rule.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setActionMenuOpen(actionMenuOpen === rule.id ? null : rule.id)
                    }
                    disabled={isLoading}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>

                  {actionMenuOpen === rule.id && (
                    <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-background border z-10">
                      <div className="py-1">
                        {onEdit && (
                          <button
                            onClick={() => {
                              onEdit(rule.id)
                              setActionMenuOpen(null)
                            }}
                            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                        {onToggleStatus && (
                          <button
                            onClick={() => handleToggleStatus(rule.id, rule.status)}
                            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                          >
                            {rule.status === 'active' ? (
                              <>
                                <Pause className="h-4 w-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4" />
                                Activate
                              </>
                            )}
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="w-full px-4 py-2 text-sm text-left hover:bg-accent text-destructive flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
