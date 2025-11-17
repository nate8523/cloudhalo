'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import Link from 'next/link'

const featureRequestSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters').max(2000, 'Description must be less than 2000 characters'),
  category: z.enum(['integration', 'analytics', 'alerts', 'ui', 'automation', 'other']),
})

type FeatureRequestFormValues = z.infer<typeof featureRequestSchema>

export default function NewFeatureRequestPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FeatureRequestFormValues>({
    resolver: zodResolver(featureRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'other',
    },
  })

  const onSubmit = async (data: FeatureRequestFormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit feature request')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard/feature-requests')
      }, 1500)
    } catch (error) {
      console.error('Error submitting feature request:', error)
      setError(error instanceof Error ? error.message : 'Failed to submit feature request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const categories = [
    {
      value: 'integration',
      label: 'Integration',
      description: 'Connect CloudHalo with other services (AWS, Slack, Teams, etc.)',
    },
    {
      value: 'analytics',
      label: 'Analytics',
      description: 'Advanced cost analysis, forecasting, and reporting features',
    },
    {
      value: 'alerts',
      label: 'Alerts',
      description: 'New alert types, notification improvements, and automation',
    },
    {
      value: 'ui',
      label: 'User Interface',
      description: 'Dashboard improvements, mobile app, and UX enhancements',
    },
    {
      value: 'automation',
      label: 'Automation',
      description: 'Automated cost optimization and resource management',
    },
    {
      value: 'other',
      label: 'Other',
      description: 'Any other feature or improvement',
    },
  ]

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/feature-requests">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Roadmap
          </Button>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Submit a Feature Request</CardTitle>
            <CardDescription>
              Have an idea for improving CloudHalo? We'd love to hear it! Describe your feature request below and the community can vote on it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success && (
              <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md">
                Feature request submitted successfully! Redirecting...
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Feature Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., AWS Cost Monitoring Integration"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  A clear, concise title that describes the feature
                </p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  onValueChange={(value) => setValue('category', value as any)}
                  defaultValue={watch('category')}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{category.label}</span>
                          <span className="text-xs text-muted-foreground">{category.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-500">{errors.category.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Choose the category that best fits your request
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  placeholder="Describe your feature request in detail. Include:&#10;- What problem does it solve?&#10;- How would it work?&#10;- Why is it valuable?&#10;- Any examples or use cases?"
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Provide a detailed description of the feature (50-2000 characters)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 justify-end">
                <Link href="/dashboard/feature-requests">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mt-6 bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">Tips for a Great Feature Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex gap-2">
              <span className="font-semibold">✓</span>
              <span>Be specific about the problem you're trying to solve</span>
            </p>
            <p className="flex gap-2">
              <span className="font-semibold">✓</span>
              <span>Explain why this feature would be valuable to MSPs</span>
            </p>
            <p className="flex gap-2">
              <span className="font-semibold">✓</span>
              <span>Include examples or use cases if possible</span>
            </p>
            <p className="flex gap-2">
              <span className="font-semibold">✓</span>
              <span>Check existing requests to avoid duplicates</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
