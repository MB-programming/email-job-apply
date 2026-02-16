import React from 'react'
import {
  MessageSquare,
  Inbox,
  Send,
  Settings,
  PenSquare,
  Bot,
  Briefcase,
  FileText,
  Globe
} from 'lucide-react'
import type { View } from '../App'
import { useLang } from '../contexts/LanguageContext'

interface SidebarProps {
  activeView: View
  onNavigate: (view: View) => void
  onCompose: () => void
}

export default function Sidebar({
  activeView,
  onNavigate,
  onCompose
}: SidebarProps): React.ReactElement {
  const { t } = useLang()

  const navItems: { view: View; icon: React.ElementType; labelKey: string }[] = [
    { view: 'chat', icon: Bot, labelKey: 'aiChat' },
    { view: 'jobs', icon: Briefcase, labelKey: 'jobScraper' },
    { view: 'collector', icon: Globe, labelKey: 'jobCollector' },
    { view: 'cv', icon: FileText, labelKey: 'cvBuilder' },
    { view: 'inbox', icon: Inbox, labelKey: 'inbox' },
    { view: 'sent', icon: Send, labelKey: 'sent' },
    { view: 'settings', icon: Settings, labelKey: 'settings' }
  ]

  return (
    <aside className="w-60 flex flex-col bg-surface-50 border-r border-border flex-shrink-0">
      {/* Compose Button */}
      <div className="p-3">
        <button
          onClick={onCompose}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-light transition-colors text-white font-medium text-sm"
        >
          <PenSquare size={16} />
          {t('compose')}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ view, icon: Icon, labelKey }) => (
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
            {t(labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </nav>

      {/* Footer — branding + developer credits */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-accent-dark flex items-center justify-center text-xs font-bold text-white">
            OJ
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Orbtasoft Jobs Apply</p>
            <p className="text-xs text-muted truncate">v1.0.0</p>
          </div>
          <MessageSquare size={14} className="text-muted flex-shrink-0" />
        </div>
        <div className="px-2 pt-2 pb-0.5">
          <p className="text-[10px] text-muted leading-relaxed">
            برمجة وتصميم: Mena Boules
          </p>
          <div className="flex gap-2 mt-0.5">
            <a
              href="https://minaboules.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-accent/70 hover:text-accent transition-colors"
              onClick={(e) => { e.preventDefault(); window.open('https://minaboules.com') }}
            >
              minaboules.com
            </a>
            <span className="text-[10px] text-muted">|</span>
            <a
              href="https://orbtasoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-accent/70 hover:text-accent transition-colors"
              onClick={(e) => { e.preventDefault(); window.open('https://orbtasoft.com') }}
            >
              orbtasoft.com
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
