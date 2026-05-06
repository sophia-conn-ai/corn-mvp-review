import { useState, useEffect } from 'react'
import type { Candidate } from '../types'

interface RecruiterGroup {
  recruiterName: string
  hired: Candidate[]
  other: Candidate[]
}

const gradeColor = (grade: string) => {
  if (grade === 'Strong Yes' || grade === 'Yes') return 'text-green-700 bg-green-50 border-green-200'
  if (grade === 'No' || grade === 'Definitely Not') return 'text-red-700 bg-red-50 border-red-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}

const GradeSummary = ({ candidate }: { candidate: Candidate }) => {
  const counts: Record<string, number> = {}
  for (const g of candidate.grades) {
    counts[g.grade] = (counts[g.grade] ?? 0) + 1
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return <span className="text-xs text-gray-400">No grades</span>
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([grade, count]) => (
        <span
          key={grade}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${gradeColor(grade)}`}
        >
          {grade} ×{count}
        </span>
      ))}
    </div>
  )
}

const CandidateRow = ({ candidate }: { candidate: Candidate }) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg border ${candidate.hired ? 'border-green-200 bg-green-50/40' : 'border-gray-200 bg-white'}`}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={candidate.greenhouse_link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 hover:text-primary truncate"
        >
          {candidate.name}
        </a>
        {candidate.hired && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Hired
          </span>
        )}
        {!candidate.hired && candidate.stage && (
          <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
            {candidate.stage}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{candidate.role}</div>
      <div className="mt-1.5">
        <GradeSummary candidate={candidate} />
      </div>
    </div>
    <div className="text-xs text-gray-400 shrink-0 mt-0.5">
      {new Date(candidate.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </div>
  </div>
)

const LegacyView = () => {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<RecruiterGroup[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/legacy')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load legacy data')
        return r.json() as Promise<Candidate[]>
      })
      .then((candidates) => {
        const byRecruiter: Record<string, RecruiterGroup> = {}
        for (const c of candidates) {
          if (!byRecruiter[c.recruiter_name]) {
            byRecruiter[c.recruiter_name] = { recruiterName: c.recruiter_name, hired: [], other: [] }
          }
          if (c.hired) {
            byRecruiter[c.recruiter_name].hired.push(c)
          } else {
            byRecruiter[c.recruiter_name].other.push(c)
          }
        }
        const sorted = Object.values(byRecruiter).sort(
          (a, b) => b.hired.length - a.hired.length || a.recruiterName.localeCompare(b.recruiterName)
        )
        setGroups(sorted)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const totalHired = groups.reduce((n, g) => n + g.hired.length, 0)
  const totalCandidates = groups.reduce((n, g) => n + g.hired.length + g.other.length, 0)

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Legacy</h1>
          {!loading && !error && (
            <p className="text-sm text-gray-500 mt-1">
              {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''} reviewed
              {totalHired > 0 && (
                <> &middot; <span className="text-green-700 font-medium">{totalHired} hired</span></>
              )}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center text-gray-500">
            <div className="animate-spin mr-3 h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            Loading...
          </div>
        ) : error ? (
          <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
        ) : groups.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-lg p-8 text-center text-gray-500">
            No candidates submitted yet.
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.recruiterName}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-base font-semibold text-gray-800">{group.recruiterName}</h2>
                  {group.hired.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                      {group.hired.length} hired MVP{group.hired.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {group.hired.length + group.other.length} total
                  </span>
                </div>
                <div className="space-y-2">
                  {group.hired.map((c) => <CandidateRow key={c.id} candidate={c} />)}
                  {group.other.map((c) => <CandidateRow key={c.id} candidate={c} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LegacyView
