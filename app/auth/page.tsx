'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Image
          src="/logo.png"
          alt="PetComplete"
          width={180}
          height={60}
          className="mx-auto object-contain"
          priority
        />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => handleTabChange('login')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              tab === 'login'
                ? 'text-brand-green border-b-2 border-brand-green'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => handleTabChange('signup')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${
              tab === 'signup'
                ? 'text-brand-green border-b-2 border-brand-green'
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-brand-green">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-100">
              <p className="text-xs text-brand-green">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-brand-green hover:bg-brand-green/90 active:bg-brand-green/80 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
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
                className="text-brand-green font-medium hover:underline"
              >
                Sign up free
              </button>
            </p>
          )}
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        By continuing, you agree to PetComplete&apos;s Terms &amp; Privacy Policy.
      </p>
    </div>
  )
}
