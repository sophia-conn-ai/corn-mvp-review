import { useState } from 'react'
import type { Candidate, Grade } from '../types'

interface CandidateCardProps {
  candidate: Candidate
  userName: string
  onClick: () => void
  onGradeUpdate: (updated: Candidate) => void
}

const POSITIVE_GRADES = new Set<Grade>(['Yes', 'Strong Yes'])
const GRADE_OPTIONS: Grade[] = ['Definitely Not', 'No', 'Yes', 'Strong Yes']

const gradeBadgeClass = (grade: Grade) => {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'
  return POSITIVE_GRADES.has(grade)
    ? `${base} bg-green-100 text-green-700`
    : `${base} bg-red-100 text-red-700`
}

const CandidateCard = ({ candidate, userName, onClick, onGradeUpdate }: CandidateCardProps) => {
  const grades = candidate.grades ?? []
  const myGrade = grades.find((g) => g.user_name === userName)?.grade
  const [saving, setSaving] = useState(false)

  const counts = grades.reduce<Partial<Record<Grade, number>>>((acc, g) => {
    acc[g.grade] = (acc[g.grade] ?? 0) + 1
    return acc
  }, {})

  const gradeOrder: Grade[] = ['Definitely Not', 'No', 'Yes', 'Strong Yes']

  const handleGradeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const selected = e.target.value as Grade
    if (!userName.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName.trim(), grade: selected }),
      })
      if (res.ok) {
        const updated: Candidate = await res.json()
        onGradeUpdate(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const selectColorClass = myGrade
    ? POSITIVE_GRADES.has(myGrade)
      ? 'border-green text-green bg-green-50'
      : 'border-red text-red bg-red-50'
    : 'border-gray-200 text-gray-500 bg-white'

  const startDate = candidate.process_start_date ?? candidate.submitted_at
  const daysInProcess = Math.floor(
    (Date.now() - new Date(startDate).getTime()) / 86400000
  )

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-300 rounded-lg p-4 flex flex-col gap-2 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900">{candidate.name}</div>
          <div className="text-sm text-gray-500">{candidate.role}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-400 font-medium">Day {daysInProcess}</span>
          {candidate.stage && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {candidate.stage}
            </span>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Recruiter: <span className="font-medium text-gray-800">{candidate.recruiter_name}</span>
      </div>

      <a
        href={candidate.greenhouse_link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-sm text-primary hover:underline truncate"
      >
        Greenhouse Profile →
      </a>

      {/* Grade dropdown */}
      <div onClick={(e) => e.stopPropagation()}>
        {!userName.trim() ? (
          <p className="text-xs text-gray-400">Set your name in the sidebar to grade</p>
        ) : (
          <select
            value={myGrade ?? ''}
            onChange={handleGradeChange}
            disabled={saving}
            className={`w-full px-2.5 py-1.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-300 transition-colors disabled:opacity-50 ${selectColorClass}`}
          >
            <option value="" disabled>Your grade...</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}
      </div>

      {/* Team grade summary */}
      {grades.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-2 mt-1">
          {gradeOrder.map((g) =>
            counts[g] ? (
              <span key={g} className={gradeBadgeClass(g)}>
                {g} ×{counts[g]}
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}

export default CandidateCard
