import type { Candidate, Grade, UserGrade } from '../types'

const GRADE_SCORE: Record<Grade, number> = {
  'Definitely Not': -2,
  'No': -1,
  'Yes': 1,
  'Strong Yes': 2,
}

interface CandidateModalProps {
  candidate: Candidate
  userName: string
  onClose: () => void
}

const gradeBadgeClass = (grade: Grade) => {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
  const positive = grade === 'Yes' || grade === 'Strong Yes'
  return positive
    ? `${base} bg-green-100 text-green-700`
    : `${base} bg-red-100 text-red-700`
}

const userInitial = (name: string) =>
  name.trim() ? name.trim()[0].toUpperCase() : '?'

const CandidateModal = ({ candidate, userName, onClose }: CandidateModalProps) => {
  const grades = candidate.grades ?? []
  const hasVoted = grades.some((g) => g.user_name === userName)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{candidate.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{candidate.role}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4 mt-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="text-gray-600">
              Recruiter: <span className="font-medium text-gray-800">{candidate.recruiter_name}</span>
            </div>
            {candidate.stage && (
              <div className="text-gray-600">
                Stage: <span className="font-medium text-gray-800">{candidate.stage}</span>
              </div>
            )}
            <div className="text-gray-600">
              Days in process:{' '}
              <span className="font-medium text-gray-800">
                {Math.floor((Date.now() - new Date(candidate.process_start_date ?? candidate.submitted_at).getTime()) / 86400000)}
              </span>
            </div>
            <a
              href={candidate.greenhouse_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Greenhouse Profile →
            </a>
          </div>

          {/* Team grades */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Team Grades</h3>
              {hasVoted && grades.length > 0 && (
                <span className="text-sm font-semibold text-gray-500">
                  Score: {grades.reduce((sum, g) => sum + GRADE_SCORE[g.grade], 0)}
                </span>
              )}
            </div>
            {grades.length === 0 ? (
              <p className="text-sm text-gray-400">No grades yet.</p>
            ) : !hasVoted ? (
              <p className="text-sm text-gray-400">
                {grades.length} {grades.length === 1 ? 'person has' : 'people have'} voted — add your grade to see results.
              </p>
            ) : (
              <ul className="space-y-2">
                {grades.map((ug: UserGrade) => (
                  <li key={ug.user_name} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                      {userInitial(ug.user_name)}
                    </div>
                    <span className="text-sm text-gray-700 flex-1">{ug.user_name}</span>
                    <span className={gradeBadgeClass(ug.grade)}>{ug.grade}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandidateModal
