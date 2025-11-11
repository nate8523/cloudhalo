'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Bell, DollarSign, TrendingUp, Wallet, AlertTriangle } from 'lucide-react'

const alertRuleSchema = z.object({
  tenant_id: z.string().min(1, 'Please select a tenant'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  type: z.enum(['THRESHOLD', 'PERCENTAGE_SPIKE', 'BUDGET', 'ANOMALY']),
  threshold_amount: z.number().positive().optional().nullable(),
  threshold_percent: z.number().min(0).max(100).optional().nullable(),
  notification_channels: z.object({
    email: z.boolean(),
  }),
  status: z.enum(['active', 'paused']),
})

type AlertRuleFormData = z.infer<typeof alertRuleSchema>

interface AlertRuleFormProps {
  tenants: Array<{ id: string; name: string }>
  onSubmit: (data: AlertRuleFormData) => Promise<void>
  onCancel: () => void
  defaultValues?: Partial<AlertRuleFormData>
  isLoading?: boolean
}

export function AlertRuleForm({
  tenants,
  onSubmit,
  onCancel,
  defaultValues,
  isLoading = false,
}: AlertRuleFormProps) {
  const [selectedType, setSelectedType] = useState(defaultValues?.type || 'PERCENTAGE_SPIKE')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AlertRuleFormData>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: {
      tenant_id: defaultValues?.tenant_id || '',
      name: defaultValues?.name || '',
      type: defaultValues?.type || 'PERCENTAGE_SPIKE',
      threshold_amount: defaultValues?.threshold_amount,
      threshold_percent: defaultValues?.threshold_percent,
      notification_channels: defaultValues?.notification_channels || { email: true },
      status: defaultValues?.status || 'active',
    },
  })

  const watchedType = watch('type')

  const handleTypeChange = (type: string) => {
    setSelectedType(type as 'THRESHOLD' | 'PERCENTAGE_SPIKE' | 'BUDGET' | 'ANOMALY')
    setValue('type', type as any)
  }

  const alertTypes = [
    {
      type: 'PERCENTAGE_SPIKE',
      name: 'Percentage Spike',
      description: 'Alert when costs increase by a percentage',
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-100 dark:bg-orange-950',
      needsPercent: true,
    },
    {
      type: 'THRESHOLD',
      name: 'Cost Threshold',
      description: 'Alert when costs exceed a dollar amount',
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-950',
      needsAmount: true,
    },
    {
      type: 'BUDGET',
      name: 'Budget Alert',
      description: 'Alert when spending reaches a budget percentage',
      icon: Wallet,
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-950',
      needsPercent: true,
    },
    {
      type: 'ANOMALY',
      name: 'Anomaly Detection',
      description: 'Alert for unusual spending patterns',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-100 dark:bg-red-950',
      needsAmount: true,
    },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Tenant Selection */}
      <div className="space-y-2">
        <Label htmlFor="tenant_id">Tenant *</Label>
        <select
          id="tenant_id"
          {...register('tenant_id')}
          className="w-full px-3 py-2 border rounded-md bg-background"
          disabled={isLoading}
        >
          <option value="">Select a tenant...</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
        {errors.tenant_id && (
          <p className="text-sm text-destructive">{errors.tenant_id.message}</p>
        )}
      </div>

      {/* Alert Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Alert Name *</Label>
        <input
          id="name"
          type="text"
          {...register('name')}
          placeholder="e.g., Daily Cost Spike Alert"
          className="w-full px-3 py-2 border rounded-md bg-background"
          disabled={isLoading}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Alert Type Selection */}
      <div className="space-y-2">
        <Label>Alert Type *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alertTypes.map((alertType) => {
            const Icon = alertType.icon
            const isSelected = watchedType === alertType.type

            return (
              <Card
                key={alertType.type}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  isSelected ? 'ring-2 ring-primary border-primary' : ''
                }`}
                onClick={() => handleTypeChange(alertType.type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${alertType.bg}`}>
                      <Icon className={`h-5 w-5 ${alertType.color}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{alertType.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alertType.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        {errors.type && (
          <p className="text-sm text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* Threshold Configuration */}
      <div className="space-y-4">
        <Label>Threshold Configuration *</Label>

        {/* Show threshold amount input for THRESHOLD and ANOMALY types */}
        {(watchedType === 'THRESHOLD' || watchedType === 'ANOMALY') && (
          <div className="space-y-2">
            <Label htmlFor="threshold_amount">
              Daily Cost Threshold (USD)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                id="threshold_amount"
                type="number"
                step="0.01"
                {...register('threshold_amount', { valueAsNumber: true })}
                placeholder="100.00"
                className="w-full pl-7 pr-3 py-2 border rounded-md bg-background"
                disabled={isLoading}
              />
            </div>
            {errors.threshold_amount && (
              <p className="text-sm text-destructive">{errors.threshold_amount.message}</p>
            )}
          </div>
        )}

        {/* Show threshold percent input for PERCENTAGE_SPIKE and BUDGET types */}
        {(watchedType === 'PERCENTAGE_SPIKE' || watchedType === 'BUDGET') && (
          <div className="space-y-2">
            <Label htmlFor="threshold_percent">
              {watchedType === 'PERCENTAGE_SPIKE' ? 'Increase Percentage' : 'Budget Percentage'}
            </Label>
            <div className="relative">
              <input
                id="threshold_percent"
                type="number"
                step="1"
                min="0"
                max="100"
                {...register('threshold_percent', { valueAsNumber: true })}
                placeholder="30"
                className="w-full pr-8 pl-3 py-2 border rounded-md bg-background"
                disabled={isLoading}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            {errors.threshold_percent && (
              <p className="text-sm text-destructive">{errors.threshold_percent.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Notification Channels */}
      <div className="space-y-2">
        <Label>Notification Channels</Label>
        <div className="flex items-center space-x-2">
          <input
            id="email"
            type="checkbox"
            {...register('notification_channels.email')}
            className="h-4 w-4 rounded border-gray-300"
            disabled={isLoading}
          />
          <Label htmlFor="email" className="font-normal cursor-pointer">
            Email notifications
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Additional notification channels (Teams, Slack) will be available soon
        </p>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          {...register('status')}
          className="w-full px-3 py-2 border rounded-md bg-background"
          disabled={isLoading}
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Bell className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Create Alert Rule
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
