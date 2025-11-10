'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Cloud, TrendingDown, Bell, Shield, ArrowRight, Zap } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-950">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full mb-4">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
              Check your email
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              We&apos;ve sent you a confirmation link to <span className="font-semibold text-gray-900 dark:text-white">{email}</span>
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Click the link in the email to verify your account and get started with CloudHalo.
            </p>
          </div>

          <Link href="/login" className="block">
            <Button variant="outline" className="w-full h-12 text-base border-2 border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-700 p-8 lg:p-12 flex-col justify-between overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        {/* Floating Orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-lg blur-sm opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <Cloud className="h-10 w-10 text-white relative" />
            </div>
            <span className="text-3xl font-bold text-white">CloudHalo</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Start Your Free 14-Day Trial
            </h1>
            <p className="text-xl text-blue-100 leading-relaxed">
              Join 500+ MSPs managing Azure tenants more efficiently. No credit card required.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3 text-white">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Ready in 15 Minutes</p>
                <p className="text-sm text-blue-100">From signup to first insights</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 text-white">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Average $12K Savings</p>
                <p className="text-sm text-blue-100">First month optimization value</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 text-white">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Read-Only Access</p>
                <p className="text-sm text-blue-100">Secure monitoring, zero risk</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/20">
            <p className="text-blue-100 text-sm">
              "We went from managing 30 Azure portals to one dashboard. Game changer for our team."
            </p>
            <p className="text-white font-semibold mt-2">— Mike T., Technical Director</p>
          </div>
        </div>

        <div className="relative z-10 text-blue-100 text-sm">
          © 2025 CloudHalo. Built for MSPs managing Azure.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-950">
        <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <Link href="/" className="inline-flex items-center space-x-2 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur-sm opacity-50"></div>
                <Cloud className="h-8 w-8 text-blue-600 relative" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">CloudHalo</span>
            </Link>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
              Create your account
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              Start your 14-day free trial. No credit card required.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Company Name</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Your MSP Company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                  className="h-12 text-base bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600 text-white shadow-xl shadow-blue-600/40 hover:shadow-2xl hover:shadow-blue-600/50 dark:shadow-blue-500/30 dark:hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-neutral-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-950 text-gray-500 dark:text-gray-400">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 sm:h-12 text-sm sm:text-base border-2 border-gray-300 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-400 dark:hover:border-blue-600 text-gray-900 dark:text-gray-100 transition-all"
              disabled={loading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23">
                <path fill="#f25022" d="M0 0h11v11H0z"/>
                <path fill="#00a4ef" d="M12 0h11v11H12z"/>
                <path fill="#7fba00" d="M0 12h11v11H0z"/>
                <path fill="#ffb900" d="M12 12h11v11H12z"/>
              </svg>
              Continue with Microsoft
            </Button>

            <p className="text-sm text-center text-gray-600 dark:text-gray-300">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                Sign in
              </Link>
            </p>
          </form>

          <div className="pt-4 sm:pt-6 border-t border-gray-300 dark:border-neutral-700">
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
              <span>14-day free trial • No credit card required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
