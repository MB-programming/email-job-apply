import React from 'react'
import {
  MessageSquare,
  Inbox,
  Send,
  Settings,
  PenSquare,
  Bot
} from 'lucide-react'
import type { View } from '../App'

interface SidebarProps {
  activeView: View
  onNavigate: (view: View) => void
  onCompose: () => void
}

const navItems: { view: View; icon: React.ElementType; label: string }[] = [
  { view: 'chat', icon: Bot, label: 'AI Chat' },
  { view: 'inbox', icon: Inbox, label: 'Inbox' },
  { view: 'sent', icon: Send, label: 'Sent' },
  { view: 'settings', icon: Settings, label: 'Settings' }
]

export default function Sidebar({
  activeView,
  onNavigate,
  onCompose
}: SidebarProps): React.ReactElement {
  return (
    <aside className="w-60 flex flex-col bg-surface-50 border-r border-border flex-shrink-0">
      {/* Compose Button */}
      <div className="p-3">
        <button
          onClick={onCompose}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-light transition-colors text-white font-medium text-sm"
        >
          <PenSquare size={16} />
          Compose Email
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ view, icon: Icon, label }) => (
          <button
            key={view}
            onClick={() => onNavigate(view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeView === view
                ? 'bg-surface-200 text-white'
                : 'text-muted hover:text-white hover:bg-surface-100'
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-accent-dark flex items-center justify-center text-xs font-bold text-white">
            MB
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">MailBot</p>
            <p className="text-xs text-muted truncate">v1.0.0</p>
          </div>
          <MessageSquare size={14} className="text-muted flex-shrink-0" />
        </div>
      </div>
    </aside>
  )
}
