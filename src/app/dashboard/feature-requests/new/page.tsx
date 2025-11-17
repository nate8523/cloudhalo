'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const featureRequestSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters').max(2000, 'Description must be less than 2000 characters'),
  category: z.enum(['integration', 'analytics', 'alerts', 'ui', 'automation', 'other'], {
    required_error: 'Please select a category',
  }),
})

type FeatureRequestFormValues = z.infer<typeof featureRequestSchema>

export default function NewFeatureRequestPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FeatureRequestFormValues>({
    resolver: zodResolver(featureRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      category: undefined,
    },
  })

  const onSubmit = async (data: FeatureRequestFormValues) => {
    setIsSubmitting(true)
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

      toast.success('Feature request submitted successfully!')
      router.push('/dashboard/feature-requests')
    } catch (error) {
      console.error('Error submitting feature request:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit feature request')
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feature Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., AWS Cost Monitoring Integration"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A clear, concise title that describes the feature
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormDescription>
                        Choose the category that best fits your request
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your feature request in detail. Include:&#10;- What problem does it solve?&#10;- How would it work?&#10;- Why is it valuable?&#10;- Any examples or use cases?"
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a detailed description of the feature (50-2000 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <div className="flex gap-4 justify-end">
                  <Link href="/dashboard/feature-requests">
                    <Button type="button" variant="outline">
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
            </Form>
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
