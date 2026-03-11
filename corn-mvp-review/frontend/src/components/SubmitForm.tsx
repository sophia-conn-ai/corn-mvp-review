import { useState } from 'react'

interface SubmitFormProps {
  onSuccess: () => void
}

interface FormData {
  name: string
  role: string
  recruiter_name: string
  greenhouse_link: string
}

const SubmitForm = ({ onSuccess }: SubmitFormProps) => {
  const [form, setForm] = useState<FormData>({
    name: '',
    role: '',
    recruiter_name: '',
    greenhouse_link: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        let message = `Server error (${res.status})`
        try {
          const data = await res.json()
          if (data.error) message = data.error
        } catch {}
        throw new Error(message)
      }
      setSuccess(true)
      setTimeout(onSuccess, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary'

  if (success) {
    return (
      <div className="p-8">
        <div className="max-w-xl">
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-6 text-center">
            <div className="text-xl font-semibold mb-1">Candidate submitted!</div>
            <div className="text-sm">Redirecting to Review Board...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Submit Candidate</h1>
        <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Candidate Name <span className="text-red">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team <span className="text-red">*</span>
            </label>
            <input
              type="text"
              required
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recruiter Name <span className="text-red">*</span>
            </label>
            <input
              type="text"
              required
              value={form.recruiter_name}
              onChange={(e) => setForm({ ...form, recruiter_name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Greenhouse Profile Link <span className="text-red">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://app.greenhouse.io/..."
              value={form.greenhouse_link}
              onChange={(e) => setForm({ ...form, greenhouse_link: e.target.value })}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="text-red text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Candidate'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SubmitForm
