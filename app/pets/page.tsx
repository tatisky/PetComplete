'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '../../src/lib/supabase'

interface Pet {
  id: string
  name: string
  species: string | null
  breed: string | null
  date_of_birth: string | null
  photo_url: string | null
}

function calcAge(dob: string | null): string {
  if (!dob) return ''
  const birth = new Date(dob)
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'Under 1 month'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  return months === 0 ? `${years} yr` : `${years} yr ${months} mo`
}

function PetAvatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    return (
      <div
        className="rounded-full overflow-hidden shrink-0 bg-gray-100"
        style={{ width: size, height: size }}
      >
        <Image src={url} alt={name} width={size} height={size} className="object-cover w-full h-full" />
      </div>
    )
  }
  return (
    <div
      className="rounded-full shrink-0 bg-brand-green/20 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        className="font-bold text-brand-green"
        style={{ fontSize: size * 0.38 }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function PetsPage() {
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/auth'); return }
      const { data: petsData, error: fetchErr } = await supabase
        .from('pets')
        .select('id, name, species, breed, date_of_birth, photo_url')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: true })
      if (fetchErr) {
        setError(fetchErr.message)
      } else {
        setPets(petsData ?? [])
      }
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-brand-green/30 border-t-brand-green animate-spin" />
          <p className="text-sm text-gray-400">Loading your pets…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ←
            </button>
            <h1 className="text-lg font-bold text-gray-900">My Pets</h1>
          </div>
          <Link
            href="/onboarding"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span> Add Pet
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100">
            <p className="text-sm text-brand-green">{error}</p>
          </div>
        )}

        {pets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-5">
              <span className="text-3xl font-bold text-brand-green">P</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No pets yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Add your first pet to start tracking their health, records, and more.
            </p>
            <Link
              href="/onboarding"
              className="px-6 py-3 rounded-xl bg-brand-green text-white text-sm font-bold hover:bg-brand-green/90 transition-colors shadow-sm"
            >
              Add Your First Pet
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pets.map((pet) => {
              const age = calcAge(pet.date_of_birth)
              const subtitle = [pet.species, pet.breed].filter(Boolean).join(' · ')

              return (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-brand-green/30 transition-all active:scale-[0.99]"
                >
                  <PetAvatar url={pet.photo_url} name={pet.name} size={64} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base truncate">{pet.name}</p>
                    {subtitle && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{subtitle}</p>
                    )}
                    {age && (
                      <p className="text-xs text-brand-green font-medium mt-1">{age} old</p>
                    )}
                  </div>
                  <span className="text-gray-300 text-xl shrink-0">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
