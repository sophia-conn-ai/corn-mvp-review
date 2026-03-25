import { useState, useEffect, useMemo } from 'react'
import type { Candidate, Grade } from '../types'
import CandidateCard from './CandidateCard'
import CandidateModal from './CandidateModal'

interface CandidateListProps {
  userName: string
}

const GRADE_SCORE: Record<Grade, number> = {
  'Definitely Not': -2,
  'No': -1,
  'Yes': 1,
  'Strong Yes': 2,
}

const candidateScore = (c: Candidate) =>
  c.grades.reduce((sum, g) => sum + GRADE_SCORE[g.grade], 0)

const formatWeekLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

type SortOrder = 'none' | 'high-low' | 'low-high'

const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary bg-white'

const CandidateList = ({ userName }: CandidateListProps) => {
  const [weeksLoading, setWeeksLoading] = useState(true)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [weeks, setWeeks] = useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('All')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/candidates/weeks')
      .then((r) => r.json())
      .then((data: string[]) => {
        setWeeks(data)
        if (data.length > 0) setSelectedWeek(data[0])
      })
      .catch(() => {})
      .finally(() => setWeeksLoading(false))
  }, [])

  useEffect(() => {
    if (selectedWeek === null) return
    setCandidatesLoading(true)
    setError(null)
    setSelectedRecruiter('All')
    setSortOrder('none')
    fetch(`/api/candidates?week=${selectedWeek}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch candidates')
        return r.json() as Promise<Candidate[]>
      })
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setCandidatesLoading(false))
  }, [selectedWeek])

  const handleGradeUpdate = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setActiveCandidate(updated)
  }

  const recruiters = useMemo(() => {
    const names = Array.from(new Set(candidates.map((c) => c.recruiter_name))).sort()
    return ['All', ...names]
  }, [candidates])

  const displayed = useMemo(() => {
    let list = selectedRecruiter === 'All'
      ? candidates
      : candidates.filter((c) => c.recruiter_name === selectedRecruiter)

    if (sortOrder === 'high-low') {
      list = [...list].sort((a, b) => candidateScore(b) - candidateScore(a))
    } else if (sortOrder === 'low-high') {
      list = [...list].sort((a, b) => candidateScore(a) - candidateScore(b))
    }

    return list
  }, [candidates, selectedRecruiter, sortOrder])

  const isLoading = weeksLoading || candidatesLoading

  return (
    <>
      <div className="p-8">
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Review Board</h1>
            {weeks.length > 0 && (
              <select
                value={selectedWeek ?? ''}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className={selectClass}
              >
                {weeks.map((w) => (
                  <option key={w} value={w}>{formatWeekLabel(w)}</option>
                ))}
              </select>
            )}
          </div>

          {!isLoading && candidates.length > 1 && (
            <div className="flex gap-3 mb-5">
              <select
                value={selectedRecruiter}
                onChange={(e) => setSelectedRecruiter(e.target.value)}
                className={selectClass}
              >
                {recruiters.map((r) => (
                  <option key={r} value={r}>{r === 'All' ? 'All Recruiters' : r}</option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className={selectClass}
              >
                <option value="none">Sort by Score</option>
                <option value="high-low">Score: High → Low</option>
                <option value="low-high">Score: Low → High</option>
              </select>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center text-gray-500">
              <div className="animate-spin mr-3 h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              Loading...
            </div>
          ) : error ? (
            <div className="text-red text-sm bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
          ) : displayed.length === 0 ? (
            <div className="bg-white border border-gray-300 rounded-lg p-8 text-center text-gray-500">
              {weeks.length === 0
                ? 'No candidates submitted yet. Submit a candidate to get started.'
                : 'No candidates for this week.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayed.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  userName={userName}
                  onClick={() => setActiveCandidate(c)}
                  onGradeUpdate={handleGradeUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeCandidate && (
        <CandidateModal
          candidate={activeCandidate}
          userName={userName}
          onClose={() => setActiveCandidate(null)}
        />
      )}
    </>
  )
}

export default CandidateList
