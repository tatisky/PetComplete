'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'

type Tab = 'login' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Account created! Check your email to confirm your account, then log in.')
        setTab('login')
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500 mb-4 shadow-lg">
          <span className="text-3xl">🐾</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PetComplete</h1>
        <p className="text-sm text-gray-500 mt-1">Your pet&apos;s health, all in one place</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => handleTabChange('login')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              tab === 'login'
                ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => handleTabChange('signup')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              tab === 'signup'
                ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
            />
          </div>

          {/* Error / Success messages */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <span className="text-red-500 text-xs mt-0.5">⚠</span>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
              <span className="text-green-500 text-xs mt-0.5">✓</span>
              <p className="text-xs text-green-700">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
          >
            {loading
              ? tab === 'login' ? 'Logging in…' : 'Creating account…'
              : tab === 'login' ? 'Log In' : 'Create Account'
            }
          </button>

          {tab === 'login' && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => handleTabChange('signup')}
                className="text-teal-600 font-medium hover:underline"
              >
                Sign up free
              </button>
            </p>
          )}
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        By continuing, you agree to PetComplete&apos;s Terms & Privacy Policy.
      </p>
    </div>
  )
}
