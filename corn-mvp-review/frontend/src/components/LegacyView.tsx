import { useState, useEffect } from 'react'
import type { Candidate } from '../types'

// Predefined pipeline order — stages not in this list appear at the end alphabetically.
const STAGE_ORDER = [
  'IPS',
  'Sell Chat',
  'TPS',
  'Onsite',
  'Leads Chat',
  'Post Leads Chat',
  'Offer',
  'Hired',
]

const stageRank = (stage: string) => {
  const idx = STAGE_ORDER.findIndex((s) => s.toLowerCase() === stage.toLowerCase())
  return idx === -1 ? STAGE_ORDER.length : idx
}

const daysAgo = (candidate: Candidate) =>
  Math.floor((Date.now() - new Date(candidate.process_start_date ?? candidate.submitted_at).getTime()) / 86400000)

const KanbanCard = ({ candidate, onClick }: { candidate: Candidate; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all"
  >
    <div className="flex items-start justify-between gap-2 mb-1">
      <span className="font-semibold text-gray-900 text-sm leading-tight">{candidate.name}</span>
      <span className="text-xs text-gray-400 font-medium shrink-0">{daysAgo(candidate)}d</span>
    </div>
    <div className="text-xs text-gray-500 truncate mb-1">{candidate.role}</div>
    <div className="text-xs text-gray-500">{candidate.recruiter_name}</div>
    {candidate.hired && (
      <div className="mt-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Hired
        </span>
      </div>
    )}
  </div>
)

const CandidateDetailModal = ({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-40"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between p-5 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{candidate.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{candidate.role}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 mt-0.5">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <div className="p-5 space-y-3 text-sm">
        <div className="text-gray-600">Recruiter: <span className="font-medium text-gray-900">{candidate.recruiter_name}</span></div>
        {candidate.stage && <div className="text-gray-600">Stage: <span className="font-medium text-gray-900">{candidate.stage}</span></div>}
        <div className="text-gray-600">Days in process: <span className="font-medium text-gray-900">{daysAgo(candidate)}</span></div>
        {candidate.hired && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            ✓ Hired
          </span>
        )}
        <a
          href={candidate.greenhouse_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Greenhouse Profile →
        </a>
        {candidate.grades.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Review Board Grades</div>
            <div className="flex flex-wrap gap-1">
              {candidate.grades.map((g) => (
                <span key={g.user_name} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                  {g.user_name}: {g.grade}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)

const LegacyView = () => {
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState<{ stage: string; candidates: Candidate[] }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null)

  useEffect(() => {
    fetch('/api/legacy')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load legacy data')
        return r.json() as Promise<Candidate[]>
      })
      .then((candidates) => {
        const byStage: Record<string, Candidate[]> = {}
        for (const c of candidates) {
          const key = c.stage || 'Unknown'
          if (!byStage[key]) byStage[key] = []
          byStage[key].push(c)
        }
        const sorted = Object.entries(byStage)
          .sort(([a], [b]) => stageRank(a) - stageRank(b) || a.localeCompare(b))
          .map(([stage, candidates]) => ({ stage, candidates }))
        setColumns(sorted)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const totalCandidates = columns.reduce((n, col) => n + col.candidates.length, 0)
  const totalHired = columns.reduce((n, col) => n + col.candidates.filter((c) => c.hired).length, 0)

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-6 pt-6 pb-3 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Legacy</h1>
          {!loading && !error && (
            <p className="text-sm text-gray-500 mt-1">
              {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''}
              {totalHired > 0 && (
                <> &middot; <span className="text-green-700 font-medium">{totalHired} hired</span></>
              )}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center text-gray-500 px-6">
            <div className="animate-spin mr-3 h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            Loading...
          </div>
        ) : error ? (
          <div className="mx-6 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
        ) : columns.length === 0 ? (
          <div className="mx-6 bg-white border border-gray-300 rounded-lg p-8 text-center text-gray-500">
            No candidates submitted yet.
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto px-6 pb-6">
            <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
              {columns.map((col) => (
                <div key={col.stage} className="flex flex-col w-52 shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                      {col.stage}
                    </span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      col.stage.toLowerCase() === 'hired'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {col.candidates.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="flex flex-col gap-2 overflow-y-auto">
                    {col.candidates.map((c) => (
                      <KanbanCard key={c.id} candidate={c} onClick={() => setActiveCandidate(c)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeCandidate && (
        <CandidateDetailModal candidate={activeCandidate} onClose={() => setActiveCandidate(null)} />
      )}
    </>
  )
}

export default LegacyView
