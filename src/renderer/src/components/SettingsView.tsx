import React, { useState, useEffect } from 'react'
import {
  Settings,
  Key,
  Mail,
  User,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Wifi
} from 'lucide-react'
import type { EmailConfig } from '../types/electron.d'

type Tab = 'email' | 'openai' | 'profile'

const defaultEmailConfig: EmailConfig = {
  imapHost: '',
  imapPort: 993,
  imapTLS: true,
  smtpHost: '',
  smtpPort: 587,
  smtpTLS: false,
  user: '',
  password: '',
  fromName: ''
}

const EMAIL_PRESETS: Record<string, Partial<EmailConfig>> = {
  gmail: {
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapTLS: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpTLS: false
  },
  outlook: {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapTLS: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpTLS: false
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapTLS: true,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpTLS: false
  }
}

export default function SettingsView(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('email')
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(defaultEmailConfig)
  const [openaiKey, setOpenaiKey] = useState('')
  const [profile, setProfile] = useState({ name: '', skills: '', cvPath: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [cfg, key, prof] = await Promise.all([
        window.api.settings.getEmailConfig(),
        window.api.settings.getOpenAIKey(),
        window.api.settings.getProfile()
      ])
      if (cfg) setEmailConfig(cfg)
      if (key) setOpenaiKey(key)
      if (prof) setProfile({ name: prof.name || '', skills: prof.skills || '', cvPath: prof.cvPath || '' })
    } catch (err) {
      console.error('Failed to load settings', err)
    }
  }

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setSaveMsg({ type, text })
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const saveEmailConfig = async () => {
    setSaving(true)
    try {
      await window.api.settings.saveEmailConfig(emailConfig)
      showFeedback('success', 'Email settings saved')
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const saveOpenAIKey = async () => {
    setSaving(true)
    try {
      await window.api.settings.saveOpenAIKey(openaiKey)
      showFeedback('success', 'API key saved')
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await window.api.settings.saveProfile(profile)
      showFeedback('success', 'Profile saved')
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const result = await window.api.email.testConnection()
      if (result.imap && result.smtp) {
        showFeedback('success', 'Connection successful! IMAP and SMTP are working.')
      } else {
        showFeedback(
          'error',
          `Connection failed: ${result.error || 'Unknown error'}. IMAP: ${result.imap ? 'OK' : 'Failed'}, SMTP: ${result.smtp ? 'OK' : 'Failed'}`
        )
      }
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  const applyPreset = (preset: string) => {
    const p = EMAIL_PRESETS[preset]
    if (p) setEmailConfig((prev) => ({ ...prev, ...p }))
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'email', icon: Mail, label: 'Email Account' },
    { id: 'openai', icon: Key, label: 'OpenAI API' },
    { id: 'profile', icon: User, label: 'Your Profile' }
  ]

  return (
    <div className="flex h-full">
      {/* Tab sidebar */}
      <div className="w-48 border-r border-border flex flex-col p-3 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-3 mb-2">
          <Settings size={16} className="text-accent" />
          <span className="text-sm font-semibold text-white">Settings</span>
        </div>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              tab === id
                ? 'bg-surface-200 text-white font-medium'
                : 'text-muted hover:text-white hover:bg-surface-100'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-8">
        {saveMsg && (
          <div
            className={`flex items-center gap-2 mb-6 px-4 py-3 rounded-xl text-sm ${
              saveMsg.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}
          >
            {saveMsg.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {saveMsg.text}
          </div>
        )}

        {/* Email Settings */}
        {tab === 'email' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Email Account</h2>
              <p className="text-sm text-muted">Connect your email account to send and receive messages.</p>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-xs text-muted mb-2 uppercase tracking-wider">Quick Setup</label>
              <div className="flex gap-2">
                {['gmail', 'outlook', 'yahoo'].map((p) => (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className="px-4 py-2 text-sm rounded-lg bg-surface-100 border border-border hover:border-accent hover:text-white text-white/70 transition-colors capitalize"
                  >
                    {p === 'gmail' ? 'Gmail' : p === 'outlook' ? 'Outlook' : 'Yahoo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Account info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={emailConfig.fromName}
                  onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                  placeholder="Your Name"
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={emailConfig.user}
                  onChange={(e) => setEmailConfig({ ...emailConfig, user: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1.5">Password / App Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={emailConfig.password}
                    onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                    placeholder="Your email password or app-specific password"
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1">
                  For Gmail, use an App Password (Google Account &gt; Security &gt; App Passwords)
                </p>
              </div>
            </div>

            {/* IMAP */}
            <div>
              <label className="block text-xs text-muted mb-2 uppercase tracking-wider">IMAP (Receive)</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={emailConfig.imapHost}
                    onChange={(e) => setEmailConfig({ ...emailConfig, imapHost: e.target.value })}
                    placeholder="imap.gmail.com"
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                  />
                </div>
                <input
                  type="number"
                  value={emailConfig.imapPort}
                  onChange={(e) => setEmailConfig({ ...emailConfig, imapPort: Number(e.target.value) })}
                  className="bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-accent transition-colors"
                />
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConfig.imapTLS}
                  onChange={(e) => setEmailConfig({ ...emailConfig, imapTLS: e.target.checked })}
                  className="accent-accent"
                />
                <span className="text-xs text-muted">Use TLS/SSL</span>
              </label>
            </div>

            {/* SMTP */}
            <div>
              <label className="block text-xs text-muted mb-2 uppercase tracking-wider">SMTP (Send)</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={emailConfig.smtpHost}
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                  />
                </div>
                <input
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => setEmailConfig({ ...emailConfig, smtpPort: Number(e.target.value) })}
                  className="bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-accent transition-colors"
                />
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConfig.smtpTLS}
                  onChange={(e) => setEmailConfig({ ...emailConfig, smtpTLS: e.target.checked })}
                  className="accent-accent"
                />
                <span className="text-xs text-muted">Use SSL (port 465)</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={testing || !emailConfig.user}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-100 border border-border hover:border-accent text-sm text-white disabled:opacity-50 transition-colors"
              >
                <Wifi size={14} className={testing ? 'animate-pulse' : ''} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={saveEmailConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-50 transition-colors"
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {/* OpenAI Settings */}
        {tab === 'openai' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">OpenAI API Key</h2>
              <p className="text-sm text-muted">
                Your API key is stored locally and never sent anywhere except OpenAI.
              </p>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-muted mt-1.5">
                Get your API key from{' '}
                <span className="text-accent">platform.openai.com/api-keys</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-100 border border-border">
              <h3 className="text-sm font-medium text-white mb-2">Model Used</h3>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-white/80">GPT-4o</span>
                <span className="text-muted text-xs">— Best for email writing and company research</span>
              </div>
            </div>

            <button
              onClick={saveOpenAIKey}
              disabled={saving || !openaiKey}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        )}

        {/* Profile Settings */}
        {tab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Your Profile</h2>
              <p className="text-sm text-muted">
                This info is used when generating job application emails.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Your full name"
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Skills & Technologies</label>
                <textarea
                  value={profile.skills}
                  onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                  placeholder="e.g. React, TypeScript, Node.js, Python, AWS, 3 years experience..."
                  rows={4}
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Default CV Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profile.cvPath}
                    onChange={(e) => setProfile({ ...profile, cvPath: e.target.value })}
                    placeholder="Path to your CV file"
                    readOnly
                    className="flex-1 bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none cursor-default"
                  />
                  <button
                    onClick={async () => {
                      const file = await window.api.email.pickAttachment()
                      if (file) setProfile({ ...profile, cvPath: file.path })
                    }}
                    className="px-4 py-2.5 rounded-lg bg-surface-100 border border-border hover:border-accent text-sm text-white transition-colors whitespace-nowrap"
                  >
                    Browse
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
