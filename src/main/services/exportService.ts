import { dialog, BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType
} from 'docx'
import * as XLSX from 'xlsx'

export interface CVData {
  language: 'en' | 'de' | 'ar'
  name: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  website: string
  summary: string
  experience: {
    id: string
    company: string
    role: string
    startDate: string
    endDate: string
    current: boolean
    location: string
    bullets: string[]
  }[]
  education: {
    id: string
    degree: string
    school: string
    field: string
    startDate: string
    endDate: string
    gpa?: string
  }[]
  skills: string[]
  languages: { id: string; language: string; level: string }[]
  certifications: { id: string; name: string; issuer: string; date: string; url?: string }[]
}

export interface JobRow {
  title: string
  company: string
  date: string
  description: string
  applyUrl: string
  email: string
  source: string
  location: string
}

// ─── CV → PDF via Electron BrowserWindow ───────────────────────────────────
export async function exportCVToPDF(htmlContent: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save CV as PDF',
      defaultPath: path.join(app.getPath('downloads'), 'CV.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (!filePath) return { success: false }

    const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { javascript: false } })
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
    await new Promise((r) => setTimeout(r, 500))

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })
    if (!win.isDestroyed()) win.destroy()

    fs.writeFileSync(filePath, pdfBuffer)
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ─── CV → Image via Electron BrowserWindow ─────────────────────────────────
export async function exportCVToImage(htmlContent: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save CV as Image',
      defaultPath: path.join(app.getPath('downloads'), 'CV.png'),
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })
    if (!filePath) return { success: false }

    const win = new BrowserWindow({ show: false, width: 900, height: 1200 })
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
    await new Promise((r) => setTimeout(r, 600))

    const img = await win.webContents.capturePage()
    if (!win.isDestroyed()) win.destroy()

    fs.writeFileSync(filePath, img.toPNG())
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ─── CV → Word (.docx) ──────────────────────────────────────────────────────
export async function exportCVToWord(cv: CVData): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save CV as Word',
      defaultPath: path.join(app.getPath('downloads'), 'CV.docx'),
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    })
    if (!filePath) return { success: false }

    const isRTL = cv.language === 'ar'
    const align = isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT

    const sectionHeader = (text: string) =>
      new Paragraph({
        text: text.toUpperCase(),
        heading: HeadingLevel.HEADING_2,
        alignment: align,
        spacing: { before: 300, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '7C3AED' } }
      })

    const bullet = (text: string) =>
      new Paragraph({ text: `• ${text}`, alignment: align, spacing: { before: 60 } })

    const children: Paragraph[] = [
      // Header
      new Paragraph({ text: cv.name, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: cv.title, alignment: AlignmentType.CENTER }),
      new Paragraph({
        children: [
          new TextRun({ text: cv.email, color: '7C3AED' }),
          new TextRun('  |  '),
          new TextRun(cv.phone),
          new TextRun('  |  '),
          new TextRun(cv.location)
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      })
    ]

    // Summary
    if (cv.summary) {
      children.push(sectionHeader('Summary'))
      children.push(new Paragraph({ text: cv.summary, alignment: align }))
    }

    // Experience
    if (cv.experience.length) {
      children.push(sectionHeader('Experience'))
      for (const exp of cv.experience) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: exp.role, bold: true }),
            new TextRun(' — '),
            new TextRun({ text: exp.company, italics: true })
          ],
          alignment: align
        }))
        children.push(new Paragraph({
          text: `${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}  ${exp.location}`,
          alignment: align, style: 'IntenseQuote'
        }))
        for (const b of exp.bullets) children.push(bullet(b))
        children.push(new Paragraph(''))
      }
    }

    // Education
    if (cv.education.length) {
      children.push(sectionHeader('Education'))
      for (const edu of cv.education) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: edu.degree + (edu.field ? ` in ${edu.field}` : ''), bold: true }),
            new TextRun(' — '),
            new TextRun({ text: edu.school, italics: true })
          ],
          alignment: align
        }))
        children.push(new Paragraph({
          text: `${edu.startDate} – ${edu.endDate}${edu.gpa ? `  |  GPA: ${edu.gpa}` : ''}`,
          alignment: align
        }))
        children.push(new Paragraph(''))
      }
    }

    // Skills
    if (cv.skills.length) {
      children.push(sectionHeader('Skills'))
      children.push(new Paragraph({ text: cv.skills.join('  •  '), alignment: align }))
    }

    // Languages
    if (cv.languages.length) {
      children.push(sectionHeader('Languages'))
      for (const l of cv.languages) {
        children.push(new Paragraph({ text: `${l.language}: ${l.level}`, alignment: align }))
      }
    }

    // Certifications
    if (cv.certifications.length) {
      children.push(sectionHeader('Certifications'))
      for (const c of cv.certifications) {
        children.push(new Paragraph({
          children: [new TextRun({ text: c.name, bold: true }), new TextRun(` — ${c.issuer} (${c.date})`)],
          alignment: align
        }))
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children }]
    })

    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(filePath, buffer)
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ─── Jobs → Excel ──────────────────────────────────────────────────────────
export async function exportJobsToExcel(jobs: JobRow[]): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Jobs as Excel',
      defaultPath: path.join(app.getPath('downloads'), 'Jobs.xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (!filePath) return { success: false }

    const ws = XLSX.utils.json_to_sheet(
      jobs.map((j) => ({
        'Job Title': j.title,
        'Company': j.company,
        'Location': j.location,
        'Date': j.date,
        'Source': j.source,
        'Email': j.email,
        'Apply URL': j.applyUrl,
        'Description': j.description
      }))
    )

    // Column widths
    ws['!cols'] = [
      { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
      { wch: 12 }, { wch: 30 }, { wch: 50 }, { wch: 80 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Jobs')
    XLSX.writeFile(wb, filePath)
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ─── Jobs → Word table ──────────────────────────────────────────────────────
export async function exportJobsToWord(jobs: JobRow[]): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Jobs as Word',
      defaultPath: path.join(app.getPath('downloads'), 'Jobs.docx'),
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    })
    if (!filePath) return { success: false }

    const headerRow = new TableRow({
      children: ['Job Title', 'Company', 'Location', 'Email', 'Apply URL', 'Date'].map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
            shading: { type: ShadingType.SOLID, color: '7C3AED', fill: '7C3AED' },
            width: { size: 1500, type: WidthType.DXA }
          })
      )
    })

    const dataRows = jobs.map(
      (j) =>
        new TableRow({
          children: [j.title, j.company, j.location, j.email, j.applyUrl, j.date].map(
            (val) =>
              new TableCell({
                children: [new Paragraph({ text: val || '', alignment: AlignmentType.LEFT })],
                width: { size: 1500, type: WidthType.DXA }
              })
          )
        })
    )

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: 'Job Collection Results', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: `Generated: ${new Date().toLocaleString()}`, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
            new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } })
          ]
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(filePath, buffer)
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
