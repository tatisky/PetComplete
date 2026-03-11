'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '../src/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/auth')
        return
      }
      // Redirect to onboarding if user has no pets yet
      const { data: pets } = await supabase
        .from('pets')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1)
      if (!pets || pets.length === 0) {
        router.replace('/onboarding')
        return
      }
      setUser(data.user)
      setLoading(false)
    })
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-brand-blue/20 border-t-brand-blue animate-spin" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Image
            src="/logo.png"
            alt="PetComplete"
            width={130}
            height={44}
            className="object-contain"
            priority
          />
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-brand-red font-medium transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Welcome card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-wider mb-1">Welcome back</p>
          <h2 className="text-xl font-bold text-gray-900 mb-1 truncate">{user?.email}</h2>
          <p className="text-sm text-gray-500">Manage your pets&apos; health records, appointments, and more.</p>
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pets"
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all active:scale-95 border-t-4 border-t-brand-blue"
            >
              <span className="text-2xl block mb-2">🐶</span>
              <p className="text-sm font-semibold text-gray-900">My Pets</p>
              <p className="text-xs text-gray-400 mt-0.5">View &amp; manage pets</p>
            </Link>
            {[
              { icon: '📋', label: 'Health Records', desc: 'Vaccinations & visits', accent: 'border-t-4 border-t-olive' },
              { icon: '📅', label: 'Appointments', desc: 'Book a vet visit', accent: 'border-t-4 border-t-coral' },
              { icon: '💊', label: 'Medications', desc: 'Track prescriptions', accent: 'border-t-4 border-t-light-blue' },
            ].map((item) => (
              <button
                key={item.label}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition-all active:scale-95 ${item.accent}`}
              >
                <span className="text-2xl block mb-2">{item.icon}</span>
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Coming soon banner */}
        <div className="bg-brand-red rounded-2xl p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Coming Soon</p>
          <p className="font-semibold text-base">More features are on the way!</p>
          <p className="text-sm opacity-80 mt-1">We&apos;re building the full PetComplete experience for you.</p>
        </div>
      </main>
    </div>
  )
}
