'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../src/lib/supabase'

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Guinea Pig', 'Reptile', 'Other']

interface PetForm {
  name: string
  species: string
  breed: string
  dateOfBirth: string
  sex: 'Male' | 'Female' | ''
  spayedNeutered: boolean | null
  weightLbs: string
  colorMarkings: string
  allergies: string[]
}

const initialForm: PetForm = {
  name: '',
  species: '',
  breed: '',
  dateOfBirth: '',
  sex: '',
  spayedNeutered: null,
  weightLbs: '',
  colorMarkings: '',
  allergies: [],
}

// ── Reusable sub-components ──────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T | ''
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
            value === opt
              ? 'bg-brand-blue text-white border-brand-blue'
              : 'bg-white text-gray-500 border-gray-200 hover:border-brand-blue/40'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function DocUploadCard({
  icon,
  title,
  subtitle,
  file,
  onFileChange,
  accept,
}: {
  icon: string
  title: string
  subtitle: string
  file: File | null
  onFileChange: (f: File | null) => void
  accept: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`relative flex items-center gap-4 bg-white rounded-2xl p-4 border-2 cursor-pointer transition-colors ${
        file ? 'border-brand-blue' : 'border-dashed border-gray-200 hover:border-brand-blue/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${file ? 'bg-brand-blue/10' : 'bg-gray-50'}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {file ? file.name : subtitle}
        </p>
      </div>
      {file ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFileChange(null) }}
          className="shrink-0 w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-brand-red flex items-center justify-center text-xs transition-colors"
        >
          ✕
        </button>
      ) : (
        <span className="shrink-0 w-7 h-7 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-lg font-light">+</span>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const petIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const [form, setForm] = useState<PetForm>(initialForm)
  const [allergyInput, setAllergyInput] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [vaccineFile, setVaccineFile] = useState<File | null>(null)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guard: redirect to /auth if not logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth')
    })
  }, [router])

  const set = <K extends keyof PetForm>(key: K, val: PetForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const addAllergy = () => {
    const tag = allergyInput.trim()
    if (tag && !form.allergies.includes(tag)) {
      set('allergies', [...form.allergies, tag])
      setAllergyInput('')
    }
  }

  // ── Step 1 submit ──────────────────────────────────────────────────────────
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }
      userIdRef.current = user.id

      // 1. Insert pet record
      const { data: pet, error: insertErr } = await supabase
        .from('pets')
        .insert({
          user_id: user.id,
          name: form.name,
          species: form.species || null,
          breed: form.breed || null,
          date_of_birth: form.dateOfBirth || null,
          sex: form.sex || null,
          spayed_neutered: form.spayedNeutered,
          weight_lbs: form.weightLbs ? parseFloat(form.weightLbs) : null,
          color_markings: form.colorMarkings || null,
          allergies: form.allergies.length > 0 ? form.allergies : null,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr
      petIdRef.current = pet.id

      // 2. Upload profile photo if selected
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `${user.id}/${pet.id}/profile.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('pet-photos')
          .upload(path, photoFile, { upsert: true })

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('pet-photos')
            .getPublicUrl(path)
          await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', pet.id)
        }
      }

      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 document upload ────────────────────────────────────────────────
  const handleDocumentSave = async () => {
    const uid = userIdRef.current
    const pid = petIdRef.current
    if (!uid || !pid) { router.replace('/'); return }

    setLoading(true)
    const uploads: Promise<unknown>[] = []

    if (vaccineFile) {
      const ext = vaccineFile.name.split('.').pop()
      uploads.push(
        supabase.storage
          .from('pet-photos')
          .upload(`${uid}/${pid}/vaccine-records.${ext}`, vaccineFile, { upsert: true })
      )
    }
    if (insuranceFile) {
      const ext = insuranceFile.name.split('.').pop()
      uploads.push(
        supabase.storage
          .from('pet-photos')
          .upload(`${uid}/${pid}/insurance.${ext}`, insuranceFile, { upsert: true })
      )
    }

    await Promise.all(uploads)
    setLoading(false)
    router.replace('/')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Image src="/logo.png" alt="PetComplete" width={120} height={40} className="object-contain" priority />
          <span className="text-xs font-medium text-gray-400">Step {step} of 2</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-1 bg-brand-red transition-all duration-500"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>

      <main className="max-w-lg mx-auto px-4 py-8">
        {step === 1 ? (
          <StepOne
            form={form}
            set={set}
            allergyInput={allergyInput}
            setAllergyInput={setAllergyInput}
            addAllergy={addAllergy}
            photoPreview={photoPreview}
            photoInputRef={photoInputRef}
            handlePhotoChange={handlePhotoChange}
            loading={loading}
            error={error}
            onSubmit={handleStep1Submit}
          />
        ) : (
          <StepTwo
            vaccineFile={vaccineFile}
            setVaccineFile={setVaccineFile}
            insuranceFile={insuranceFile}
            setInsuranceFile={setInsuranceFile}
            loading={loading}
            onSave={handleDocumentSave}
            onSkip={() => router.replace('/')}
          />
        )}
      </main>
    </div>
  )
}

// ── Step 1 component ──────────────────────────────────────────────────────────

function StepOne({
  form, set, allergyInput, setAllergyInput, addAllergy,
  photoPreview, photoInputRef, handlePhotoChange,
  loading, error, onSubmit,
}: {
  form: PetForm
  set: <K extends keyof PetForm>(key: K, val: PetForm[K]) => void
  allergyInput: string
  setAllergyInput: (v: string) => void
  addAllergy: () => void
  photoPreview: string | null
  photoInputRef: React.RefObject<HTMLInputElement | null>
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  loading: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tell us about your pet</h1>
        <p className="text-sm text-gray-500 mt-1">We&apos;ll use this to build their health profile.</p>
      </div>

      {/* Photo upload */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full overflow-hidden bg-white border-2 border-dashed border-gray-300 hover:border-brand-blue transition-colors flex items-center justify-center shadow-sm"
        >
          {photoPreview ? (
            <Image src={photoPreview} alt="Pet photo" fill className="object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <span className="text-2xl">📷</span>
              <span className="text-xs font-medium">Add photo</span>
            </div>
          )}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
        <p className="text-xs text-gray-400">Tap to upload or take a photo</p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

        {/* Pet name */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Pet Name <span className="text-brand-red">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Buddy"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition"
          />
        </div>

        {/* Species */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Species</label>
          <select
            value={form.species}
            onChange={(e) => set('species', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition bg-white appearance-none"
          >
            <option value="">Select species…</option>
            {SPECIES_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Breed */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Breed</label>
          <input
            type="text"
            value={form.breed}
            onChange={(e) => set('breed', e.target.value)}
            placeholder="e.g. Golden Retriever"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition"
          />
        </div>

        {/* Date of birth */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date of Birth</label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition"
          />
        </div>

        {/* Sex */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sex</label>
          <ToggleGroup
            options={['Male', 'Female'] as const}
            value={form.sex}
            onChange={(v) => set('sex', v)}
          />
        </div>

        {/* Spayed / Neutered */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Spayed / Neutered</label>
          <ToggleGroup
            options={['Yes', 'No'] as const}
            value={form.spayedNeutered === null ? '' : form.spayedNeutered ? 'Yes' : 'No'}
            onChange={(v) => set('spayedNeutered', v === 'Yes')}
          />
        </div>

        {/* Weight */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Weight (lbs)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.weightLbs}
            onChange={(e) => set('weightLbs', e.target.value)}
            placeholder="e.g. 45.5"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition"
          />
        </div>

        {/* Color / markings */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Color / Markings</label>
          <input
            type="text"
            value={form.colorMarkings}
            onChange={(e) => set('colorMarkings', e.target.value)}
            placeholder="e.g. Golden with white chest"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition"
          />
        </div>

        {/* Known allergies */}
        <div className="p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Known Allergies</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy() } }}
              placeholder="e.g. Chicken, pollen…"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition"
            />
            <button
              type="button"
              onClick={addAllergy}
              className="px-4 py-3 rounded-xl bg-brand-blue/10 text-brand-blue text-sm font-semibold hover:bg-brand-blue/20 transition-colors"
            >
              Add
            </button>
          </div>
          {form.allergies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {form.allergies.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => set('allergies', form.allergies.filter((a) => a !== tag))}
                    className="text-brand-blue/60 hover:text-brand-red transition-colors leading-none"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <span className="text-brand-red text-xs mt-0.5">⚠</span>
          <p className="text-xs text-brand-red">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl bg-brand-red hover:bg-brand-red/90 active:bg-brand-red/80 text-white text-sm font-bold tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
      >
        {loading ? 'Saving…' : 'Continue →'}
      </button>
    </form>
  )
}

// ── Step 2 component ──────────────────────────────────────────────────────────

function StepTwo({
  vaccineFile, setVaccineFile,
  insuranceFile, setInsuranceFile,
  loading, onSave, onSkip,
}: {
  vaccineFile: File | null
  setVaccineFile: (f: File | null) => void
  insuranceFile: File | null
  setInsuranceFile: (f: File | null) => void
  loading: boolean
  onSave: () => void
  onSkip: () => void
}) {
  const hasFiles = vaccineFile !== null || insuranceFile !== null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Health documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your pet&apos;s key documents to complete their health profile. You can always add these later.
        </p>
      </div>

      <div className="space-y-3">
        <DocUploadCard
          icon="💉"
          title="Vaccine Records"
          subtitle="PDF, JPG, or PNG"
          file={vaccineFile}
          onFileChange={setVaccineFile}
          accept=".pdf,image/*"
        />
        <DocUploadCard
          icon="🏥"
          title="Insurance Documents"
          subtitle="PDF, JPG, or PNG"
          file={insuranceFile}
          onFileChange={setInsuranceFile}
          accept=".pdf,image/*"
        />
      </div>

      <div className="space-y-3 pt-2">
        {hasFiles && (
          <button
            onClick={onSave}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-brand-red hover:bg-brand-red/90 active:bg-brand-red/80 text-white text-sm font-bold tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'Uploading…' : 'Save & Continue'}
          </button>
        )}
        <button
          onClick={onSkip}
          disabled={loading}
          className="w-full py-3.5 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 text-sm font-semibold transition-colors"
        >
          {hasFiles ? 'Skip for now' : 'Skip this step'}
        </button>
      </div>

      <p className="text-xs text-center text-gray-400">
        Your documents are stored securely and only visible to you.
      </p>
    </div>
  )
}
