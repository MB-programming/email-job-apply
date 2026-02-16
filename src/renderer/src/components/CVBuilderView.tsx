import React, { useState, useRef, useCallback } from 'react'
import {
  FileText, Plus, Trash2, ChevronDown, ChevronUp,
  Download, Image, FileType, Bot, Star, AlertCircle,
  CheckCircle2, Globe, Phone, Mail, MapPin, Linkedin,
  Briefcase, GraduationCap, Wrench, Languages, Award, User
} from 'lucide-react'
import { useLang } from '../contexts/LanguageContext'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Experience {
  id: string; company: string; role: string; startDate: string; endDate: string
  current: boolean; location: string; bullets: string[]
}
interface Education {
  id: string; degree: string; school: string; field: string; startDate: string; endDate: string; gpa?: string
}
interface LangEntry { id: string; language: string; level: string }
interface Certification { id: string; name: string; issuer: string; date: string; url?: string }

interface CVData {
  language: 'en' | 'de' | 'ar'
  name: string; title: string; email: string; phone: string; location: string; linkedin: string; website: string
  summary: string
  experience: Experience[]
  education: Education[]
  skills: string[]
  languages: LangEntry[]
  certifications: Certification[]
}

const uid = () => Math.random().toString(36).slice(2)

const EMPTY_EXP = (): Experience => ({ id: uid(), company: '', role: '', startDate: '', endDate: '', current: false, location: '', bullets: [''] })
const EMPTY_EDU = (): Education => ({ id: uid(), degree: '', school: '', field: '', startDate: '', endDate: '', gpa: '' })
const EMPTY_LANG = (): LangEntry => ({ id: uid(), language: '', level: 'Professional' })
const EMPTY_CERT = (): Certification => ({ id: uid(), name: '', issuer: '', date: '', url: '' })

const LANG_LEVELS = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic']

// ─── ATS Score ────────────────────────────────────────────────────────────────
function calcATS(cv: CVData, jobDesc: string): { score: number; issues: string[]; tips: string[] } {
  const issues: string[] = []
  const tips: string[] = []
  let score = 0

  // Contact completeness (20pts)
  if (cv.name) score += 5; else issues.push('Missing name')
  if (cv.email) score += 5; else issues.push('Missing email')
  if (cv.phone) score += 5; else issues.push('Missing phone')
  if (cv.location) score += 5; else issues.push('Missing location')

  // Sections (30pts)
  if (cv.summary.length > 50) score += 10; else tips.push('Add a professional summary (50+ words)')
  if (cv.experience.length > 0) score += 10; else issues.push('Add work experience')
  if (cv.skills.length >= 5) score += 10; else tips.push('Add at least 5 skills')

  // Experience quality (20pts)
  if (cv.experience.length > 0) {
    const hasBullets = cv.experience.every((e) => e.bullets.some((b) => b.trim().length > 20))
    if (hasBullets) score += 10; else tips.push('Add detailed bullet points to each experience (20+ chars)')
    const hasDates = cv.experience.every((e) => e.startDate)
    if (hasDates) score += 10; else tips.push('Add dates to all work experiences')
  }

  // Keyword match with job description (30pts)
  if (jobDesc.trim()) {
    const jd = jobDesc.toLowerCase()
    const cvText = [cv.summary, ...cv.skills, ...cv.experience.map((e) => e.bullets.join(' ')), ...cv.experience.map((e) => e.role)].join(' ').toLowerCase()
    const jdWords = jd.match(/\b[a-zA-Z]{4,}\b/g) || []
    const uniqueJdWords = [...new Set(jdWords)].slice(0, 30)
    const matches = uniqueJdWords.filter((w) => cvText.includes(w)).length
    const matchPct = uniqueJdWords.length > 0 ? matches / uniqueJdWords.length : 0
    const keywordScore = Math.round(matchPct * 30)
    score += keywordScore
    if (matchPct < 0.3) tips.push('Low keyword match — add more keywords from the job description')
    else if (matchPct < 0.6) tips.push('Moderate keyword match — try to include more job-specific terms')
  } else {
    score += 15
    tips.push('Paste a job description to get personalized ATS recommendations')
  }

  return { score: Math.min(score, 100), issues, tips }
}

// ─── CV Preview HTML ──────────────────────────────────────────────────────────
function buildCVHTML(cv: CVData): string {
  const isRTL = cv.language === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'
  const fontFamily = isRTL ? '"Segoe UI", Arial, sans-serif' : '"Calibri", "Segoe UI", Arial, sans-serif'

  const sec = (title: string, content: string) =>
    `<div style="margin-top:20px"><div style="font-size:13px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #7C3AED;padding-bottom:4px;margin-bottom:10px">${title}</div>${content}</div>`

  const expHtml = cv.experience.map((e) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-weight:700;font-size:13px">${e.role}</span>
        <span style="font-size:11px;color:#666">${e.startDate} – ${e.current ? 'Present' : e.endDate}</span>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:4px">${e.company}${e.location ? ` · ${e.location}` : ''}</div>
      <ul style="margin:0;padding-${isRTL ? 'right' : 'left'}:18px">
        ${e.bullets.filter((b) => b.trim()).map((b) => `<li style="font-size:11.5px;margin-bottom:3px">${b}</li>`).join('')}
      </ul>
    </div>`).join('')

  const eduHtml = cv.education.map((e) => `
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-weight:700;font-size:13px">${e.degree}${e.field ? ` in ${e.field}` : ''}</span>
        <span style="font-size:11px;color:#666">${e.startDate} – ${e.endDate}</span>
      </div>
      <div style="font-size:12px;color:#555">${e.school}${e.gpa ? ` · GPA: ${e.gpa}` : ''}</div>
    </div>`).join('')

  const skillsHtml = cv.skills.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${cv.skills.map((s) => `<span style="background:#f3f0ff;color:#7C3AED;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${s}</span>`).join('')}</div>`
    : ''

  const langsHtml = cv.languages.length
    ? cv.languages.map((l) => `<div style="font-size:12px"><b>${l.language}</b>: ${l.level}</div>`).join('')
    : ''

  const certHtml = cv.certifications.filter((c) => c.name).length
    ? cv.certifications.filter((c) => c.name).map((c) => `<div style="font-size:12px"><b>${c.name}</b> — ${c.issuer} (${c.date})</div>`).join('')
    : ''

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFamily}; font-size: 12px; color: #222; background: #fff; direction: ${dir}; }
    .page { max-width: 820px; margin: 0 auto; padding: 40px; }
  </style></head><body><div class="page">
    <div style="text-align:center;border-bottom:3px solid #7C3AED;padding-bottom:16px;margin-bottom:4px">
      <h1 style="font-size:26px;font-weight:900;color:#1a1a2e;letter-spacing:0.5px">${cv.name}</h1>
      <div style="font-size:14px;color:#7C3AED;font-weight:600;margin:4px 0">${cv.title}</div>
      <div style="font-size:11.5px;color:#555;margin-top:6px;display:flex;justify-content:center;flex-wrap:wrap;gap:14px">
        ${cv.email ? `<span>✉ ${cv.email}</span>` : ''}
        ${cv.phone ? `<span>✆ ${cv.phone}</span>` : ''}
        ${cv.location ? `<span>📍 ${cv.location}</span>` : ''}
        ${cv.linkedin ? `<span>in ${cv.linkedin}</span>` : ''}
        ${cv.website ? `<span>🌐 ${cv.website}</span>` : ''}
      </div>
    </div>
    ${cv.summary ? sec('Professional Summary', `<p style="font-size:12px;line-height:1.7;color:#333">${cv.summary}</p>`) : ''}
    ${cv.experience.length ? sec('Experience', expHtml) : ''}
    ${cv.education.length ? sec('Education', eduHtml) : ''}
    ${cv.skills.length ? sec('Skills', skillsHtml) : ''}
    ${cv.languages.length ? sec('Languages', langsHtml) : ''}
    ${certHtml ? sec('Certifications', certHtml) : ''}
  </div></body></html>`
}

// ─── Section toggle helper ────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-surface-100 hover:bg-surface-200 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon size={15} className="text-accent" />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      className="w-full bg-surface-200 border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent transition-colors placeholder-muted"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      rows={rows}
      className="w-full bg-surface-200 border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent transition-colors placeholder-muted resize-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CVBuilderView(): React.ReactElement {
  const { t } = useLang()
  const previewRef = useRef<HTMLDivElement>(null)

  const [cv, setCV] = useState<CVData>({
    language: 'en', name: '', title: '', email: '', phone: '', location: '', linkedin: '', website: '',
    summary: '', experience: [], education: [], skills: [], languages: [], certifications: []
  })

  const [skillInput, setSkillInput] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [aiReview, setAiReview] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'ats'>('edit')

  const update = (patch: Partial<CVData>) => setCV((prev) => ({ ...prev, ...patch }))

  const ats = calcATS(cv, jobDesc)

  // ─── Experience helpers
  const addExp = () => update({ experience: [...cv.experience, EMPTY_EXP()] })
  const removeExp = (id: string) => update({ experience: cv.experience.filter((e) => e.id !== id) })
  const updateExp = (id: string, patch: Partial<Experience>) =>
    update({ experience: cv.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const addBullet = (id: string) =>
    update({ experience: cv.experience.map((e) => (e.id === id ? { ...e, bullets: [...e.bullets, ''] } : e)) })
  const updateBullet = (id: string, idx: number, val: string) =>
    update({ experience: cv.experience.map((e) => e.id === id ? { ...e, bullets: e.bullets.map((b, i) => i === idx ? val : b) } : e) })
  const removeBullet = (id: string, idx: number) =>
    update({ experience: cv.experience.map((e) => e.id === id ? { ...e, bullets: e.bullets.filter((_, i) => i !== idx) } : e) })

  // ─── Education helpers
  const addEdu = () => update({ education: [...cv.education, EMPTY_EDU()] })
  const removeEdu = (id: string) => update({ education: cv.education.filter((e) => e.id !== id) })
  const updateEdu = (id: string, patch: Partial<Education>) =>
    update({ education: cv.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) })

  // ─── Skills helpers
  const addSkill = () => {
    if (!skillInput.trim()) return
    update({ skills: [...new Set([...cv.skills, skillInput.trim()])] })
    setSkillInput('')
  }
  const removeSkill = (s: string) => update({ skills: cv.skills.filter((x) => x !== s) })

  // ─── Languages helpers
  const addLang = () => update({ languages: [...cv.languages, EMPTY_LANG()] })
  const removeLang = (id: string) => update({ languages: cv.languages.filter((l) => l.id !== id) })
  const updateLang = (id: string, patch: Partial<LangEntry>) =>
    update({ languages: cv.languages.map((l) => (l.id === id ? { ...l, ...patch } : l)) })

  // ─── Certifications helpers
  const addCert = () => update({ certifications: [...cv.certifications, EMPTY_CERT()] })
  const removeCert = (id: string) => update({ certifications: cv.certifications.filter((c) => c.id !== id) })
  const updateCert = (id: string, patch: Partial<Certification>) =>
    update({ certifications: cv.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  // ─── AI Review
  const handleAIReview = useCallback(async () => {
    setReviewing(true)
    setAiReview('')
    const cvText = `
Name: ${cv.name}, Title: ${cv.title}
Summary: ${cv.summary}
Experience: ${cv.experience.map((e) => `${e.role} at ${e.company}: ${e.bullets.join('; ')}`).join('\n')}
Skills: ${cv.skills.join(', ')}
Job Description: ${jobDesc || 'Not provided'}
    `
    const prompt = `Review this CV for ATS compatibility and provide specific improvements. Be concise, actionable, and structured with sections: Strengths, Issues, Keyword Recommendations, Suggested Rewrite for Summary.\n\nCV:\n${cvText}`
    const messages = [{ role: 'user' as const, content: prompt }]
    window.api.openai.onStreamChunk((chunk) => { setAiReview((prev) => prev + chunk.delta) })
    await window.api.openai.chat(messages)
    window.api.openai.removeStreamListeners()
    setReviewing(false)
  }, [cv, jobDesc])

  // ─── Exports
  const htmlContent = buildCVHTML(cv)

  const exportPDF = async () => {
    setExporting('pdf')
    await window.api.export.cvPDF(htmlContent)
    setExporting(null)
  }
  const exportImage = async () => {
    setExporting('image')
    await window.api.export.cvImage(htmlContent)
    setExporting(null)
  }
  const exportWord = async () => {
    setExporting('word')
    await window.api.export.cvWord(cv)
    setExporting(null)
  }

  const scoreColor = ats.score >= 75 ? 'text-green-400' : ats.score >= 50 ? 'text-yellow-400' : 'text-red-400'
  const scoreBarColor = ats.score >= 75 ? 'bg-green-500' : ats.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <FileText size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">CV Builder — ATS Ready</h1>
            <p className="text-xs text-muted">بناء سيرة ذاتية احترافية مع تحليل ATS</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            className="bg-surface-100 border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
            value={cv.language}
            onChange={(e) => update({ language: e.target.value as 'en' | 'de' | 'ar' })}
          >
            <option value="en">🇬🇧 English (LTR)</option>
            <option value="de">🇩🇪 Deutsch (LTR)</option>
            <option value="ar">🇸🇦 العربية (RTL)</option>
          </select>

          {/* Export buttons */}
          <button onClick={exportPDF} disabled={!!exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-400 border border-red-500/30 transition-colors disabled:opacity-40">
            <FileType size={12} /> {exporting === 'pdf' ? '...' : 'PDF'}
          </button>
          <button onClick={exportWord} disabled={!!exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-xs text-blue-400 border border-blue-500/30 transition-colors disabled:opacity-40">
            <Download size={12} /> {exporting === 'word' ? '...' : 'Word'}
          </button>
          <button onClick={exportImage} disabled={!!exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-xs text-green-400 border border-green-500/30 transition-colors disabled:opacity-40">
            <Image size={12} /> {exporting === 'image' ? '...' : 'Image'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {(['edit', 'preview', 'ats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
          >
            {tab === 'edit' ? 'Edit CV' : tab === 'preview' ? 'Preview' : `ATS Score (${ats.score}/100)`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">

        {/* ── EDIT TAB ── */}
        {activeTab === 'edit' && (
          <div className="h-full overflow-y-auto p-5 space-y-4">

            <Section title="Personal Information" icon={User}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name *"><Input value={cv.name} onChange={(v) => update({ name: v })} placeholder="Mena Boules" /></Field>
                <Field label="Job Title *"><Input value={cv.title} onChange={(v) => update({ title: v })} placeholder="Senior Software Engineer" /></Field>
                <Field label="Email *"><Input value={cv.email} onChange={(v) => update({ email: v })} placeholder="email@example.com" type="email" /></Field>
                <Field label="Phone *"><Input value={cv.phone} onChange={(v) => update({ phone: v })} placeholder="+43 650 000 0000" /></Field>
                <Field label="Location *"><Input value={cv.location} onChange={(v) => update({ location: v })} placeholder="Vienna, Austria" /></Field>
                <Field label="LinkedIn"><Input value={cv.linkedin} onChange={(v) => update({ linkedin: v })} placeholder="linkedin.com/in/username" /></Field>
                <Field label="Website / Portfolio"><Input value={cv.website} onChange={(v) => update({ website: v })} placeholder="minaboules.com" /></Field>
              </div>
            </Section>

            <Section title="Professional Summary" icon={FileText}>
              <Textarea value={cv.summary} onChange={(v) => update({ summary: v })} placeholder="A concise professional summary (3-5 sentences) highlighting your experience, key skills, and value proposition..." rows={4} />
              <p className="text-xs text-muted">{cv.summary.split(/\s+/).filter(Boolean).length} words</p>
            </Section>

            <Section title="Work Experience" icon={Briefcase}>
              {cv.experience.map((exp) => (
                <div key={exp.id} className="border border-border/60 rounded-xl p-4 space-y-3 bg-surface-100/40">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-accent">{exp.role || 'New Position'}</span>
                    <button onClick={() => removeExp(exp.id)} className="p-1 text-muted hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Job Title"><Input value={exp.role} onChange={(v) => updateExp(exp.id, { role: v })} placeholder="Software Engineer" /></Field>
                    <Field label="Company"><Input value={exp.company} onChange={(v) => updateExp(exp.id, { company: v })} placeholder="Tech GmbH" /></Field>
                    <Field label="Start Date"><Input value={exp.startDate} onChange={(v) => updateExp(exp.id, { startDate: v })} placeholder="Jan 2022" /></Field>
                    <Field label="End Date">
                      <div className="flex items-center gap-2">
                        <Input value={exp.endDate} onChange={(v) => updateExp(exp.id, { endDate: v })} placeholder="Dec 2024" />
                        <label className="flex items-center gap-1 text-xs text-muted whitespace-nowrap">
                          <input type="checkbox" checked={exp.current} onChange={(e) => updateExp(exp.id, { current: e.target.checked, endDate: '' })} />
                          Current
                        </label>
                      </div>
                    </Field>
                    <Field label="Location"><Input value={exp.location} onChange={(v) => updateExp(exp.id, { location: v })} placeholder="Vienna, AT" /></Field>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Bullet Points (achievements/responsibilities)</label>
                    {exp.bullets.map((b, idx) => (
                      <div key={idx} className="flex gap-2 mb-1.5">
                        <input
                          className="flex-1 bg-surface-200 border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
                          value={b}
                          onChange={(e) => updateBullet(exp.id, idx, e.target.value)}
                          placeholder={`Achievement or responsibility ${idx + 1}...`}
                        />
                        <button onClick={() => removeBullet(exp.id, idx)} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <button onClick={() => addBullet(exp.id)} className="text-xs text-accent hover:text-white transition-colors flex items-center gap-1 mt-1">
                      <Plus size={12} /> Add bullet
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addExp} className="w-full py-2 border border-dashed border-accent/40 rounded-xl text-sm text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> Add Experience
              </button>
            </Section>

            <Section title="Education" icon={GraduationCap}>
              {cv.education.map((edu) => (
                <div key={edu.id} className="border border-border/60 rounded-xl p-4 space-y-2 bg-surface-100/40">
                  <div className="flex justify-between">
                    <span className="text-xs text-accent font-semibold">{edu.degree || 'New Degree'}</span>
                    <button onClick={() => removeEdu(edu.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Degree"><Input value={edu.degree} onChange={(v) => updateEdu(edu.id, { degree: v })} placeholder="Bachelor of Science" /></Field>
                    <Field label="Field of Study"><Input value={edu.field} onChange={(v) => updateEdu(edu.id, { field: v })} placeholder="Computer Science" /></Field>
                    <Field label="School/University"><Input value={edu.school} onChange={(v) => updateEdu(edu.id, { school: v })} placeholder="TU Wien" /></Field>
                    <Field label="GPA (optional)"><Input value={edu.gpa || ''} onChange={(v) => updateEdu(edu.id, { gpa: v })} placeholder="3.8 / 4.0" /></Field>
                    <Field label="Start Date"><Input value={edu.startDate} onChange={(v) => updateEdu(edu.id, { startDate: v })} placeholder="Sep 2018" /></Field>
                    <Field label="End Date"><Input value={edu.endDate} onChange={(v) => updateEdu(edu.id, { endDate: v })} placeholder="Jul 2022" /></Field>
                  </div>
                </div>
              ))}
              <button onClick={addEdu} className="w-full py-2 border border-dashed border-accent/40 rounded-xl text-sm text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> Add Education
              </button>
            </Section>

            <Section title="Skills" icon={Wrench}>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-surface-200 border border-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  placeholder="React, TypeScript, Docker... (Enter to add)"
                />
                <button onClick={addSkill} className="px-3 py-1.5 bg-accent rounded-lg text-sm text-white"><Plus size={14} /></button>
              </div>
              {cv.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {cv.skills.map((s) => (
                    <span key={s} className="flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/30 rounded-full text-xs text-accent">
                      {s}
                      <button onClick={() => removeSkill(s)} className="hover:text-white"><Trash2 size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Languages" icon={Languages}>
              {cv.languages.map((l) => (
                <div key={l.id} className="flex gap-2 items-center">
                  <Input value={l.language} onChange={(v) => updateLang(l.id, { language: v })} placeholder="German" />
                  <select className="bg-surface-200 border border-border rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-accent" value={l.level} onChange={(e) => updateLang(l.id, { level: e.target.value })}>
                    {LANG_LEVELS.map((lv) => <option key={lv}>{lv}</option>)}
                  </select>
                  <button onClick={() => removeLang(l.id)} className="p-1.5 text-muted hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              ))}
              <button onClick={addLang} className="text-xs text-accent hover:text-white transition-colors flex items-center gap-1">
                <Plus size={12} /> Add Language
              </button>
            </Section>

            <Section title="Certifications" icon={Award}>
              {cv.certifications.map((c) => (
                <div key={c.id} className="border border-border/60 rounded-lg p-3 bg-surface-100/40">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-accent font-semibold">{c.name || 'New Certification'}</span>
                    <button onClick={() => removeCert(c.id)} className="p-1 text-muted hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Name"><Input value={c.name} onChange={(v) => updateCert(c.id, { name: v })} placeholder="AWS Solutions Architect" /></Field>
                    <Field label="Issuer"><Input value={c.issuer} onChange={(v) => updateCert(c.id, { issuer: v })} placeholder="Amazon" /></Field>
                    <Field label="Date"><Input value={c.date} onChange={(v) => updateCert(c.id, { date: v })} placeholder="2023" /></Field>
                  </div>
                </div>
              ))}
              <button onClick={addCert} className="text-xs text-accent hover:text-white transition-colors flex items-center gap-1">
                <Plus size={12} /> Add Certification
              </button>
            </Section>
          </div>
        )}

        {/* ── PREVIEW TAB ── */}
        {activeTab === 'preview' && (
          <div className="h-full overflow-auto bg-gray-100 p-6">
            <div
              ref={previewRef}
              className="bg-white shadow-2xl rounded max-w-4xl mx-auto"
              dangerouslySetInnerHTML={{ __html: buildCVHTML(cv) }}
            />
          </div>
        )}

        {/* ── ATS TAB ── */}
        {activeTab === 'ats' && (
          <div className="h-full overflow-y-auto p-5 space-y-5">
            {/* Score */}
            <div className="flex items-center gap-6 p-5 bg-surface-100 rounded-2xl border border-border">
              <div className="text-center">
                <div className={`text-5xl font-black ${scoreColor}`}>{ats.score}</div>
                <div className="text-xs text-muted mt-1">ATS Score</div>
              </div>
              <div className="flex-1">
                <div className="h-4 bg-surface-300 rounded-full overflow-hidden">
                  <div className={`h-full ${scoreBarColor} rounded-full transition-all duration-700`} style={{ width: `${ats.score}%` }} />
                </div>
                <p className="text-xs text-muted mt-2">
                  {ats.score >= 75 ? '✅ Good — likely to pass ATS screening' : ats.score >= 50 ? '⚠️ Fair — needs improvement' : '❌ Poor — likely to be rejected by ATS'}
                </p>
              </div>
            </div>

            {/* Job description input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Job Description (for keyword matching)</label>
              <Textarea value={jobDesc} onChange={setJobDesc} placeholder="Paste the job description here to get accurate ATS scoring and keyword recommendations..." rows={5} />
            </div>

            {/* Issues */}
            {ats.issues.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-400">Issues to Fix</h3>
                {ats.issues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-300 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                    <AlertCircle size={14} /> {issue}
                  </div>
                ))}
              </div>
            )}

            {/* Tips */}
            {ats.tips.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-yellow-400">Recommendations</h3>
                {ats.tips.map((tip, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-yellow-200/80 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                    <Star size={13} /> {tip}
                  </div>
                ))}
              </div>
            )}

            {ats.issues.length === 0 && ats.tips.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 bg-green-500/5 border border-green-500/15 rounded-lg px-4 py-3">
                <CheckCircle2 size={16} /> Your CV looks great! Keep refining with job-specific keywords.
              </div>
            )}

            {/* AI Review */}
            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-surface-100">
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-accent" />
                  <span className="text-sm font-semibold text-white">AI Review & Suggestions</span>
                </div>
                <button
                  onClick={handleAIReview}
                  disabled={reviewing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-xs text-white disabled:opacity-40 transition-colors"
                >
                  <Bot size={12} />
                  {reviewing ? 'Reviewing...' : 'Analyze with AI'}
                </button>
              </div>
              {aiReview && (
                <div className="p-4 text-sm text-white/80 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {aiReview}
                </div>
              )}
              {!aiReview && !reviewing && (
                <div className="p-6 text-center text-sm text-muted">
                  Click "Analyze with AI" to get detailed CV feedback and personalized improvement suggestions
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
