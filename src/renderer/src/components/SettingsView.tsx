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
  Wifi,
  Bot,
  Star
} from 'lucide-react'
import type { EmailConfig } from '../types/electron.d'
import { useLang } from '../contexts/LanguageContext'

type Tab = 'email' | 'model' | 'profile'

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

interface ModelDef {
  id: string
  name: string
  provider: string
  tier: string
  description: string
}

export default function SettingsView(): React.ReactElement {
  const { t } = useLang()
  const [tab, setTab] = useState<Tab>('email')
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(defaultEmailConfig)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Model settings
  const [models, setModels] = useState<ModelDef[]>([])
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash')
  const [openaiKey, setOpenaiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [showKeys, setShowKeys] = useState({ openai: false, gemini: false, groq: false })

  // Profile settings
  const [profile, setProfile] = useState({ name: '', skills: '', cvPath: '' })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [cfg, mods, selModel, oKey, gKey, grKey, prof] = await Promise.all([
        window.api.settings.getEmailConfig(),
        window.api.openai.getModels(),
        window.api.openai.getSelectedModel(),
        window.api.settings.getOpenAIKey(),
        window.api.settings.getGeminiKey(),
        window.api.settings.getGroqKey(),
        window.api.settings.getProfile()
      ])
      if (cfg) setEmailConfig(cfg)
      if (mods) setModels(mods)
      if (selModel) setSelectedModel(selModel)
      if (oKey) setOpenaiKey(oKey)
      if (gKey) setGeminiKey(gKey)
      if (grKey) setGroqKey(grKey)
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
      showFeedback('success', t('emailSentSuccess').replace('sent', 'saved'))
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const saveModelSettings = async () => {
    setSaving(true)
    try {
      await Promise.all([
        window.api.openai.setSelectedModel(selectedModel),
        window.api.settings.saveOpenAIKey(openaiKey),
        window.api.settings.saveGeminiKey(geminiKey),
        window.api.settings.saveGroqKey(groqKey)
      ])
      showFeedback('success', t('saving').replace('...', '') + ' done')
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
      showFeedback('success', t('saveProfile') + ' done')
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
        showFeedback('success', t('connectionSuccess'))
      } else {
        showFeedback('error', `Connection failed: ${result.error || 'Unknown'}`)
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
    { id: 'email', icon: Mail, label: t('emailAccount') },
    { id: 'model', icon: Bot, label: t('aiModel') },
    { id: 'profile', icon: User, label: t('yourProfile') }
  ]

  const freeModels = models.filter((m) => m.tier === 'free')
  const paidModels = models.filter((m) => m.tier === 'paid')
  const selectedModelDef = models.find((m) => m.id === selectedModel)

  return (
    <div className="flex h-full">
      {/* Tab sidebar */}
      <div className="w-48 border-r border-border flex flex-col p-3 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-3 mb-2">
          <Settings size={16} className="text-accent" />
          <span className="text-sm font-semibold text-white">{t('settingsTitle')}</span>
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
            {saveMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {saveMsg.text}
          </div>
        )}

        {/* Email Settings */}
        {tab === 'email' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">{t('emailAccount')}</h2>
            </div>

            <div>
              <label className="block text-xs text-muted mb-2 uppercase tracking-wider">{t('quickSetup')}</label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1.5">{t('displayName')}</label>
                <input
                  type="text"
                  value={emailConfig.fromName}
                  onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                  placeholder={t('displayNamePlaceholder')}
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1.5">{t('emailAddress')}</label>
                <input
                  type="email"
                  value={emailConfig.user}
                  onChange={(e) => setEmailConfig({ ...emailConfig, user: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1.5">{t('password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={emailConfig.password}
                    onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                    placeholder={t('passwordPlaceholder')}
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
                <p className="text-xs text-muted mt-1">{t('gmailTip')}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-2 uppercase tracking-wider">{t('imapReceive')}</label>
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
                <span className="text-xs text-muted">{t('useTLS')}</span>
              </label>
            </div>

            <div>
              <label className="block text-xs text-muted mb-2 uppercase tracking-wider">{t('smtpSend')}</label>
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
                <span className="text-xs text-muted">{t('useSSL')}</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={testing || !emailConfig.user}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-100 border border-border hover:border-accent text-sm text-white disabled:opacity-50 transition-colors"
              >
                <Wifi size={14} className={testing ? 'animate-pulse' : ''} />
                {testing ? t('testing') : t('testConnection')}
              </button>
              <button
                onClick={saveEmailConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-50 transition-colors"
              >
                <Save size={14} />
                {saving ? t('saving') : t('saveSettings')}
              </button>
            </div>
          </div>
        )}

        {/* AI Model Settings */}
        {tab === 'model' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">{t('aiModel')}</h2>
              <p className="text-sm text-muted">{t('apiKeyDesc')}</p>
            </div>

            {/* Active model badge */}
            {selectedModelDef && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/10 border border-accent/30">
                <Bot size={18} className="text-accent" />
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider">{t('activeModel')}</p>
                  <p className="text-sm font-semibold text-white">{selectedModelDef.name}</p>
                  <p className="text-xs text-muted">{selectedModelDef.description}</p>
                </div>
              </div>
            )}

            {/* Free models */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={13} className="text-green-400" />
                <label className="text-xs text-green-400 font-semibold uppercase tracking-wider">
                  {t('freeTier')}
                </label>
              </div>
              <div className="space-y-2">
                {freeModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      selectedModel === m.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface-100 hover:border-accent/50'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        selectedModel === m.id ? 'border-accent bg-accent' : 'border-muted'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <p className="text-xs text-muted">{m.description}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex-shrink-0">
                      FREE
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Paid models */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Key size={13} className="text-yellow-400" />
                <label className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">
                  {t('paidTier')}
                </label>
              </div>
              <div className="space-y-2">
                {paidModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      selectedModel === m.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface-100 hover:border-accent/50'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        selectedModel === m.id ? 'border-accent bg-accent' : 'border-muted'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <p className="text-xs text-muted">{m.description}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex-shrink-0">
                      PAID
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* API Keys */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h3 className="text-sm font-medium text-white pt-2">{t('apiKeyTitle')}</h3>

              {/* Gemini key */}
              <div>
                <label className="block text-xs text-muted mb-1.5">
                  Google Gemini API Key
                  <span className="ml-2 text-green-400 text-xs">(free at aistudio.google.com)</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeys.gemini ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys((k) => ({ ...k, gemini: !k.gemini }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showKeys.gemini ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Groq key */}
              <div>
                <label className="block text-xs text-muted mb-1.5">
                  Groq API Key
                  <span className="ml-2 text-green-400 text-xs">(free at console.groq.com)</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeys.groq ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys((k) => ({ ...k, groq: !k.groq }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showKeys.groq ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* OpenAI key */}
              <div>
                <label className="block text-xs text-muted mb-1.5">
                  OpenAI API Key
                  <span className="ml-2 text-yellow-400 text-xs">(paid - platform.openai.com)</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeys.openai ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys((k) => ({ ...k, openai: !k.openai }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showKeys.openai ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={saveModelSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? t('saving') : t('saveSettings')}
            </button>
          </div>
        )}

        {/* Profile Settings */}
        {tab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">{t('profileTitle')}</h2>
              <p className="text-sm text-muted">{t('profileDesc')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1.5">{t('fullName')}</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder={t('fullNamePlaceholder')}
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">{t('skills')}</label>
                <textarea
                  value={profile.skills}
                  onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                  placeholder={t('skillsPlaceholder')}
                  rows={4}
                  className="w-full bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none focus:border-accent transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">{t('defaultCVPath')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profile.cvPath}
                    readOnly
                    placeholder={t('cvPathPlaceholder')}
                    className="flex-1 bg-surface-100 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted outline-none cursor-default"
                  />
                  <button
                    onClick={async () => {
                      const file = await window.api.email.pickAttachment()
                      if (file) setProfile({ ...profile, cvPath: file.path })
                    }}
                    className="px-4 py-2.5 rounded-lg bg-surface-100 border border-border hover:border-accent text-sm text-white transition-colors whitespace-nowrap"
                  >
                    {t('browse')}
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
              {saving ? t('saving') : t('saveProfile')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
