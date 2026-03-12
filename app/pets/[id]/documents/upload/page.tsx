'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../../../src/lib/supabase'

// ── Category / type map ───────────────────────────────────────────────────────

const DOCUMENT_CATEGORIES: Record<string, string[]> = {
  'Medical Records': [
    'Vaccine Record', 'Vet Visit Summary', 'Lab/Bloodwork Results',
    'Urinalysis', 'Fecal Test', 'Imaging Report', 'Pathology Report',
    'Surgical Report', 'Anesthesia Record', 'Specialist Notes',
    'Discharge Summary', 'Dental Exam',
  ],
  'Medications & Prescriptions': [
    'Prescription', 'Pharmacy Receipt', 'Medication Instructions', 'Compounding Record',
  ],
  'Insurance': [
    'Policy Document', 'Insurance ID Card', 'Explanation of Benefits',
    'Claim Form', 'Reimbursement Statement', 'Renewal Notice', 'Denial Letter',
  ],
  'Identification & Registration': [
    'Microchip Certificate', 'License/Tags', 'Breeder Papers',
    'Pedigree', 'Adoption Paperwork', 'Purchase Agreement',
  ],
  'Preventive Care': [
    'Heartworm Test', 'Flea/Tick Prevention Record', 'Dental Cleaning', 'Grooming Notes',
  ],
  'Specialized Health Programs': [
    'Allergy Test', 'Physical Therapy Plan', 'Behavioral Assessment',
    'Nutritional Plan', 'Weight Management Record',
  ],
  'External Care Providers': [
    'Boarding Record', 'Groomer Form', 'Daycare Record', 'Training Record', 'Pet Sitter Form',
  ],
  'Travel & Compliance': [
    'Health Certificate', 'USDA Endorsed Certificate', 'International Travel Document',
    'Import/Export Permit', 'Rabies Titer Test',
  ],
  'End of Life': [
    'Euthanasia Record', 'Cremation/Burial Certificate', 'Pet Loss Insurance Document',
  ],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentUploadPage() {
  const router = useRouter()
  const params = useParams()
  const petId = params.id as string

  const [step, setStep] = useState<1 | 2>(1)
  const [category, setCategory] = useState('')
  const [docType, setDocType] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const docTypes = category ? (DOCUMENT_CATEGORIES[category] ?? []) : []

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth')
    })
  }, [router])

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    setDocType('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      setImagePreview(URL.createObjectURL(f))
    } else {
      setImagePreview(null)
    }
  }

  const handleUpload = async () => {
    if (!category || !docType || !file) return
    setUploading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const { data: doc, error: insertErr } = await supabase
        .from('documents')
        .insert({
          pet_id: petId,
          user_id: user.id,
          category,
          document_type: docType,
          file_name: file.name,
          file_url: '',
          notes: notes.trim() || null,
          parsed_data: null,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      const storagePath = `${user.id}/${petId}/${doc.id}/${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('pet-documents')
        .upload(storagePath, file, { upsert: true })

      if (uploadErr) throw uploadErr

      await supabase
        .from('documents')
        .update({ file_url: storagePath })
        .eq('id', doc.id)

      const { data: signedData, error: signedErr } = await supabase.storage
        .from('pet-documents')
        .createSignedUrl(storagePath, 3600)

      if (signedErr) throw signedErr
      setUploadedFileUrl(signedData.signedUrl)
      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleUploadAnother = () => {
    setStep(1)
    setCategory('')
    setDocType('')
    setNotes('')
    setFile(null)
    setImagePreview(null)
    setError(null)
    setUploadedFileUrl(null)
  }

  const canUpload = !!category && !!docType && !!file && !uploading

  // ── Step 2: Success ────────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div className="min-h-screen bg-cream">
        <header className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
            <button
              onClick={() => router.push(`/pets/${petId}`)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ←
            </button>
            <span className="ml-3 text-sm font-bold text-gray-900">Document Uploaded</span>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-brand-green/10 flex items-center justify-center mb-6 shadow-sm">
            <span className="text-2xl font-bold text-brand-green">OK</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Document saved!</h2>
          <p className="text-sm text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">{docType}</span> has been added to your pet&apos;s health profile.
          </p>
          <p className="text-xs text-gray-400 mb-10">{file?.name}</p>

          <div className="w-full space-y-3">
            {uploadedFileUrl && (
              <a
                href={uploadedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-4 rounded-xl bg-brand-green hover:bg-brand-green/90 text-white text-sm font-bold tracking-wide transition-colors shadow-sm"
              >
                View Document
              </a>
            )}
            <button
              onClick={handleUploadAnother}
              className="w-full py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 text-sm font-semibold transition-colors"
            >
              Upload Another Document
            </button>
            <button
              onClick={() => router.push(`/pets/${petId}`)}
              className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Back to Pet Profile
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1: Form ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push(`/pets/${petId}`)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-bold text-gray-900">Upload Document</span>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add a document</h1>
          <p className="text-sm text-gray-500 mt-1">Select the type and upload a file or photo.</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">

          <div className="p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Category <span className="text-brand-green">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition bg-white appearance-none"
            >
              <option value="">Select a category…</option>
              {Object.keys(DOCUMENT_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Document Type <span className="text-brand-green">*</span>
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={!category}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition bg-white appearance-none disabled:text-gray-400 disabled:bg-gray-50"
            >
              <option value="">{category ? 'Select document type…' : 'Select a category first…'}</option>
              {docTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this document…"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green transition resize-none"
            />
          </div>
        </div>

        {/* File upload area */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            File <span className="text-brand-green">*</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {file ? (
            <div className="bg-white rounded-2xl border border-brand-green shadow-sm overflow-hidden">
              {imagePreview ? (
                <div className="relative w-full h-48 bg-gray-50">
                  <Image src={imagePreview} alt="Preview" fill className="object-contain" />
                </div>
              ) : (
                <div className="flex items-center gap-4 p-5">
                  <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand-green">PDF</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500 truncate max-w-[70%]">{file.name}</p>
                <button
                  type="button"
                  onClick={() => { setFile(null); setImagePreview(null) }}
                  className="text-xs text-brand-green font-semibold hover:text-brand-green/70 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-gray-300 bg-white hover:border-brand-green/50 hover:bg-brand-green/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-400">FILE</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Tap to upload a file</p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG supported</p>
              </div>
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs text-brand-green">{error}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="w-full py-4 rounded-xl bg-brand-green hover:bg-brand-green/90 active:bg-brand-green/80 text-white text-sm font-bold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>

        <p className="text-xs text-center text-gray-400 pb-4">
          Files are stored securely and only visible to you.
        </p>
      </main>
    </div>
  )
}
