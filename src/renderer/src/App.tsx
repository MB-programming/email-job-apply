import React, { useState } from 'react'
import { LanguageProvider } from './contexts/LanguageContext'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import InboxView from './components/InboxView'
import SentView from './components/SentView'
import SettingsView from './components/SettingsView'
import ComposeModal from './components/ComposeModal'

export type View = 'chat' | 'inbox' | 'sent' | 'settings'

function AppInner(): React.ReactElement {
  const [activeView, setActiveView] = useState<View>('chat')
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-surface text-white select-none overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          onCompose={() => setComposeOpen(true)}
        />
        <main className="flex-1 overflow-hidden">
          {activeView === 'chat' && <ChatView />}
          {activeView === 'inbox' && <InboxView />}
          {activeView === 'sent' && <SentView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
    </div>
  )
}

export default function App(): React.ReactElement {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  )
}
