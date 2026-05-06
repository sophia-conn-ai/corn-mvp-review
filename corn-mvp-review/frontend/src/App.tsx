import { useState } from 'react'
import Sidebar from './components/Sidebar'
import SubmitForm from './components/SubmitForm'
import CandidateList from './components/CandidateList'
import LegacyView from './components/LegacyView'

type Page = 'review' | 'submit' | 'legacy'

function App() {
  const [activePage, setActivePage] = useState<Page>('review')
  const [userName, setUserName] = useState(() => localStorage.getItem('reviewer_name') ?? '')

  const handleSetUserName = (name: string) => {
    setUserName(name)
    localStorage.setItem('reviewer_name', name)
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        userName={userName}
        setUserName={handleSetUserName}
      />
      <div className="flex-1 overflow-auto">
        {activePage === 'submit' ? (
          <SubmitForm onSuccess={() => setActivePage('review')} />
        ) : activePage === 'legacy' ? (
          <LegacyView />
        ) : (
          <CandidateList userName={userName} />
        )}
      </div>
    </div>
  )
}

export default App
