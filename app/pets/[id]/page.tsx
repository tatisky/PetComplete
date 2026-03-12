'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '../../../src/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PetDocument {
  id: string
  category: string
  document_type: string
  file_name: string
  file_url: string
  notes: string | null
  created_at: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface Pet {
  id: string
  user_id: string
  name: string
  species: string | null
  breed: string | null
  date_of_birth: string | null
  sex: string | null
  spayed_neutered: boolean | null
  weight_lbs: number | null
  color_markings: string | null
  allergies: string[] | null
  photo_url: string | null
}

interface EditForm {
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

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Guinea Pig', 'Reptile', 'Other']
const TABS = ['Overview', 'Documents', 'Medications', 'Reminders'] as const
type Tab = typeof TABS[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function petToForm(pet: Pet): EditForm {
  return {
    name: pet.name,
    species: pet.species ?? '',
    breed: pet.breed ?? '',
    dateOfBirth: pet.date_of_birth ?? '',
    sex: (pet.sex as 'Male' | 'Female') ?? '',
    spayedNeutered: pet.spayed_neutered,
    weightLbs: pet.weight_lbs?.toString() ?? '',
    colorMarkings: pet.color_markings ?? '',
    allergies: pet.allergies ?? [],
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
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
              ? 'bg-brand-green text-white border-brand-green'
              : 'bg-white text-gray-500 border-gray-200 hover:border-brand-green/40'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0 mr-4">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">
        {value || <span className="text-gray-300 font-normal">—</span>}
      </span>
    </div>
  )
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PetProfilePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  // Documents state
  const [documents, setDocuments] = useState<PetDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsFetched, setDocsFetched] = useState(false)
  const [signingDocId, setSigningDocId] = useState<string | null>(null)
  const [isManagingDocs, setIsManagingDocs] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PetDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editAllergyInput, setEditAllergyInput] = useState('')
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const fetchPet = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }

    const { data, error: fetchErr } = await supabase
      .from('pets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !data) {
      setError('Pet not found.')
    } else {
      setPet(data)
    }
    setLoading(false)
  }

  useEffect(() => { fetchPet() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDocument = async (doc: PetDocument) => {
    setSigningDocId(doc.id)

    // Support both old format (full URL) and new format (bare storage path)
    const storagePath = doc.file_url.startsWith('http')
      ? doc.file_url.replace(/^.+\/pet-documents\//, '')
      : doc.file_url

    const { data, error } = await supabase.storage
      .from('pet-documents')
      .createSignedUrl(storagePath, 3600)

    setSigningDocId(null)
    if (error || !data) return

    // Programmatic anchor click works cross-browser without triggering
    // popup blockers (unlike window.open called after an await).
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const fetchDocuments = async () => {
    setDocsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('documents')
      .select('id, category, document_type, file_name, file_url, notes, created_at')
      .eq('pet_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setDocuments(data ?? [])
    setDocsLoading(false)
    setDocsFetched(true)
  }

  useEffect(() => {
    if (activeTab === 'Documents' && !docsFetched) {
      fetchDocuments()
    }
  }, [activeTab, docsFetched]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteDocument = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    const storagePath = deleteTarget.file_url.startsWith('http')
      ? deleteTarget.file_url.replace(/^.+\/pet-documents\//, '')
      : deleteTarget.file_url

    await supabase.storage.from('pet-documents').remove([storagePath])
    await supabase.from('documents').delete().eq('id', deleteTarget.id)

    setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  const startEditing = () => {
    if (!pet) return
    setEditForm(petToForm(pet))
    setEditPhotoFile(null)
    setEditPhotoPreview(pet.photo_url)
    setEditError(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditForm(null)
    setEditPhotoFile(null)
    setEditPhotoPreview(null)
    setEditError(null)
  }

  const setEdit = <K extends keyof EditForm>(key: K, val: EditForm[K]) =>
    setEditForm((f) => f ? { ...f, [key]: val } : f)

  const addEditAllergy = () => {
    const tag = editAllergyInput.trim()
    if (!tag || !editForm || editForm.allergies.includes(tag)) return
    setEdit('allergies', [...editForm.allergies, tag])
    setEditAllergyInput('')
  }

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  const handleEditSave = async () => {
    if (!editForm) return
    setEditLoading(true)
    setEditError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { error: updateErr } = await supabase
        .from('pets')
        .update({
          name: editForm.name,
          species: editForm.species || null,
          breed: editForm.breed || null,
          date_of_birth: editForm.dateOfBirth || null,
          sex: editForm.sex || null,
          spayed_neutered: editForm.spayedNeutered,
          weight_lbs: editForm.weightLbs ? parseFloat(editForm.weightLbs) : null,
          color_markings: editForm.colorMarkings || null,
          allergies: editForm.allergies.length > 0 ? editForm.allergies : null,
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateErr) throw updateErr

      if (editPhotoFile) {
        const ext = editPhotoFile.name.split('.').pop()
        const path = `${user.id}/${id}/profile.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('pet-photos')
          .upload(path, editPhotoFile, { upsert: true })

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('pet-photos')
            .getPublicUrl(path)
          await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', id)
        }
      }

      await fetchPet()
      setIsEditing(false)
      setEditForm(null)
      setEditPhotoFile(null)
      setEditPhotoPreview(null)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-brand-green/20 border-t-brand-green animate-spin" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !pet) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-gray-900 mb-2">Pet not found</p>
        <p className="text-sm text-gray-500 mb-6">{error ?? `This pet doesn't exist or you don't have access.`}</p>
        <button
          onClick={() => router.push('/pets')}
          className="px-5 py-3 rounded-xl bg-brand-green text-white text-sm font-semibold"
        >
          Back to My Pets
        </button>
      </div>
    )
  }

  const age = calcAge(pet.date_of_birth)
  const subtitle = [pet.species, pet.breed].filter(Boolean).join(' · ')

  // ── Edit mode ─────────────────────────────────────────────────────────────

  if (isEditing && editForm) {
    return (
      <div className="min-h-screen bg-cream">
        {/* Edit header */}
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={cancelEditing}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <span className="text-sm font-bold text-gray-900">Edit {pet.name}</span>
            <button
              onClick={handleEditSave}
              disabled={editLoading || !editForm.name.trim()}
              className="text-sm font-bold text-brand-green hover:text-brand-green/80 disabled:opacity-40 transition-colors"
            >
              {editLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden bg-white border-2 border-dashed border-gray-300 hover:border-brand-green transition-colors flex items-center justify-center shadow-sm"
            >
              {editPhotoPreview ? (
                <Image src={editPhotoPreview} alt="Pet" fill className="object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <span className="text-2xl">📷</span>
                  <span className="text-xs">Photo</span>
                </div>
              )}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditPhotoChange} />
            <p className="text-xs text-gray-400">Tap to change photo</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Pet Name <span className="text-brand-green">*</span>
              </label>
              <input
                type="text" required value={editForm.name}
                onChange={(e) => setEdit('name', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Species</label>
              <select
                value={editForm.species}
                onChange={(e) => setEdit('species', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition bg-white"
              >
                <option value="">Select species…</option>
                {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Breed</label>
              <input
                type="text" value={editForm.breed}
                onChange={(e) => setEdit('breed', e.target.value)}
                placeholder="e.g. Golden Retriever"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date of Birth</label>
              <input
                type="date" value={editForm.dateOfBirth}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEdit('dateOfBirth', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sex</label>
              <ToggleGroup
                options={['Male', 'Female'] as const}
                value={editForm.sex}
                onChange={(v) => setEdit('sex', v)}
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Spayed / Neutered</label>
              <ToggleGroup
                options={['Yes', 'No'] as const}
                value={editForm.spayedNeutered === null ? '' : editForm.spayedNeutered ? 'Yes' : 'No'}
                onChange={(v) => setEdit('spayedNeutered', v === 'Yes')}
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Weight (lbs)</label>
              <input
                type="number" min="0" step="0.1" value={editForm.weightLbs}
                onChange={(e) => setEdit('weightLbs', e.target.value)}
                placeholder="e.g. 45.5"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Color / Markings</label>
              <input
                type="text" value={editForm.colorMarkings}
                onChange={(e) => setEdit('colorMarkings', e.target.value)}
                placeholder="e.g. Golden with white chest"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
              />
            </div>

            <div className="p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Known Allergies</label>
              <div className="flex gap-2">
                <input
                  type="text" value={editAllergyInput}
                  onChange={(e) => setEditAllergyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditAllergy() } }}
                  placeholder="e.g. Chicken…"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition"
                />
                <button
                  type="button" onClick={addEditAllergy}
                  className="px-4 py-3 rounded-xl bg-brand-green/10 text-brand-green text-sm font-semibold hover:bg-brand-green/20 transition-colors"
                >
                  Add
                </button>
              </div>
              {editForm.allergies.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {editForm.allergies.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/10 text-brand-green text-xs font-medium">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setEdit('allergies', editForm.allergies.filter((a) => a !== tag))}
                        className="text-brand-green/60 hover:text-brand-green transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {editError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-brand-green">{editError}</p>
            </div>
          )}

          <button
            onClick={handleEditSave}
            disabled={editLoading || !editForm.name.trim()}
            className="w-full py-4 rounded-xl bg-brand-green hover:bg-brand-green/90 text-white text-sm font-bold tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {editLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  // ── Detail view ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/pets')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-bold text-gray-900 truncate mx-3">{pet.name}</span>
          {activeTab === 'Overview' && (
            <button
              onClick={startEditing}
              className="text-sm font-semibold text-brand-green hover:text-brand-green/70 transition-colors"
            >
              Edit
            </button>
          )}
          {activeTab === 'Documents' && (
            <button
              onClick={() => setIsManagingDocs((m) => !m)}
              className={`text-sm font-semibold transition-colors ${isManagingDocs ? 'text-gray-900' : 'text-brand-green hover:text-brand-green/70'}`}
            >
              {isManagingDocs ? 'Done' : 'Manage'}
            </button>
          )}
          {(activeTab === 'Medications' || activeTab === 'Reminders') && (
            <div className="w-14" />
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-8 flex flex-col items-center text-center">
          {/* Photo */}
          <div className="w-28 h-28 rounded-full overflow-hidden bg-brand-green/20 flex items-center justify-center mb-4 shadow-md ring-4 ring-white">
            {pet.photo_url ? (
              <Image
                src={pet.photo_url}
                alt={pet.name}
                width={112}
                height={112}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-4xl font-bold text-brand-green">
                {pet.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{pet.name}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {age && (
            <span className="mt-2 inline-block px-3 py-1 rounded-full bg-brand-green/10 text-brand-green text-xs font-semibold">
              {age} old
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-lg mx-auto flex border-t border-gray-100 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setIsManagingDocs(false) }}
              className={`flex-1 py-3.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-brand-green border-brand-green'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {activeTab === 'Overview' && (
          <div className="space-y-4">
            {/* Basic info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4">
              <div className="py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Info</p>
              </div>
              <InfoRow label="Date of Birth" value={pet.date_of_birth ?? null} />
              <InfoRow
                label="Sex"
                value={pet.sex ?? null}
              />
              <InfoRow
                label="Spayed / Neutered"
                value={pet.spayed_neutered === null ? null : pet.spayed_neutered ? 'Yes' : 'No'}
              />
              <InfoRow
                label="Weight"
                value={pet.weight_lbs != null ? `${pet.weight_lbs} lbs` : null}
              />
            </div>

            {/* Appearance */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4">
              <div className="py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Appearance</p>
              </div>
              <InfoRow label="Color / Markings" value={pet.color_markings ?? null} />
            </div>

            {/* Allergies */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Known Allergies</p>
              {pet.allergies && pet.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pet.allergies.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-coral/20 text-coral text-xs font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No known allergies</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Documents' && (
          <div className="space-y-4">
            {/* Upload button */}
            <Link
              href={`/pets/${id}/documents/upload`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-brand-green hover:bg-brand-green/90 text-white text-sm font-bold tracking-wide transition-colors shadow-sm"
            >
              <span className="text-base leading-none">+</span> Upload Document
            </Link>

            {docsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-4 border-brand-green/20 border-t-brand-green animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <span className="text-3xl">📄</span>
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No documents yet</p>
                <p className="text-xs text-gray-400">Upload vaccine records, insurance, and more to build a complete health profile.</p>
              </div>
            ) : (
              /* Group documents by category */
              (() => {
                const grouped = documents.reduce<Record<string, PetDocument[]>>((acc, doc) => {
                  if (!acc[doc.category]) acc[doc.category] = []
                  acc[doc.category].push(doc)
                  return acc
                }, {})

                return (
                  <div className="space-y-5">
                    {Object.entries(grouped).map(([category, docs]) => (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{category}</p>
                        </div>
                        <div className="space-y-2">
                          {docs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-2"
                            >
                              {/* Delete button (manage mode only) */}
                              {isManagingDocs && (
                                <button
                                  onClick={() => setDeleteTarget(doc)}
                                  className="shrink-0 w-8 h-8 rounded-full bg-brand-green flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                                >
                                  <span className="text-white text-lg leading-none font-bold">−</span>
                                </button>
                              )}
                              {/* Document card */}
                              <button
                                onClick={() => !isManagingDocs && handleViewDocument(doc)}
                                disabled={signingDocId === doc.id || isManagingDocs}
                                className={`flex items-center gap-3 flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left transition-all ${
                                  isManagingDocs
                                    ? 'opacity-80 cursor-default'
                                    : 'hover:shadow-md hover:border-brand-green/20 active:scale-[0.99] disabled:opacity-60'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-brand-green">
                                    {doc.file_name.endsWith('.pdf') ? 'PDF' : 'IMG'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{doc.document_type}</p>
                                  <p className="text-xs text-gray-400 truncate mt-0.5">{doc.file_name}</p>
                                  <p className="text-xs text-gray-300 mt-0.5">{formatDate(doc.created_at)}</p>
                                </div>
                                {!isManagingDocs && (
                                  <span className="text-gray-300 text-xl shrink-0">
                                    {signingDocId === doc.id ? '…' : '›'}
                                  </span>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
          </div>
        )}
        {activeTab === 'Medications' && (
          <EmptyTabState icon="💊" message="No medications added yet" />
        )}
        {activeTab === 'Reminders' && (
          <EmptyTabState icon="🔔" message="No reminders set yet" />
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-base font-bold text-gray-900 mb-1">Delete this document?</h3>
              <p className="text-sm text-gray-500 mb-1">{deleteTarget.document_type}</p>
              <p className="text-xs text-gray-400 mb-6">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDocument}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-brand-green hover:bg-brand-green/90 text-white text-sm font-bold transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
