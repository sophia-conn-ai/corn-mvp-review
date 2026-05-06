type Page = 'review' | 'submit' | 'legacy'

interface SidebarProps {
  activePage: Page
  setActivePage: (page: Page) => void
  userName: string
  setUserName: (name: string) => void
}

const Sidebar = ({ activePage, setActivePage, userName, setUserName }: SidebarProps) => {
  const pages: { id: Page; label: string }[] = [
    { id: 'submit', label: 'Submit Candidate' },
    { id: 'review', label: 'Review Board' },
    { id: 'legacy', label: 'Legacy' },
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-300 flex flex-col">
      <div className="p-6 border-b border-gray-300">
        <div className="flex items-center gap-3">
          <img
            src="/applied-logo.png"
            alt="Applied Intuition"
            className="h-10 w-auto"
          />
          <div className="text-xl font-bold text-gray-900">Candidate Review</div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                onClick={() => setActivePage(page.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activePage === page.id
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-300 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reviewing as</label>
          <input
            type="text"
            placeholder="Your name..."
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary-300"
          />
        </div>
        <div className="text-xs text-gray-400">Version 1.0.0</div>
      </div>
    </div>
  )
}

export default Sidebar
