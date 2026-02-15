import { BrowserWindow } from 'electron'
import { fetchUrl } from './webSearchService'

export interface JobListing {
  id: string
  company: string
  title: string
  location: string
  url: string
  email?: string
  source: string
  description?: string
}

export type ScrapingSource = 'linkedin' | 'indeed' | 'xing' | 'stepstone' | 'karriere'

// Regex-based email extractor with false-positive filtering
function extractAllEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi) || []
  return [...new Set(matches)].filter((e) => {
    const l = e.toLowerCase()
    return (
      !l.includes('example') &&
      !l.includes('sentry') &&
      !l.includes('noreply') &&
      !l.includes('no-reply') &&
      !l.endsWith('.png') &&
      !l.endsWith('.jpg') &&
      l.includes('@')
    )
  })
}

function pickBestEmail(emails: string[]): string | undefined {
  if (!emails.length) return undefined
  return (
    emails.find((e) => /jobs|career|bewerbung|hr|personal|recruiting/i.test(e)) || emails[0]
  )
}

// Load page in hidden BrowserWindow with retry
async function loadPageInBrowser(
  url: string,
  waitMs = 3000
): Promise<{ text: string; html: string; win: BrowserWindow }> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      javascript: true,
      images: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  await win.loadURL(url, {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  })
  await new Promise((r) => setTimeout(r, waitMs))

  const text = await win.webContents.executeJavaScript('document.body.innerText').catch(() => '')
  const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML').catch(() => '')

  return { text, html, win }
}

// ─── KARRIERE.AT (Best Austrian job board) ────────────────────────────────────
export async function scrapeKarriere(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const results: JobListing[] = []

  try {
    const searchUrl = `https://www.karriere.at/jobs?keyword=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`
    onProgress(0, 'Loading Karriere.at...')

    const { win } = await loadPageInBrowser(searchUrl, 3500)

    // Scroll to load more results
    for (let i = 0; i < Math.min(Math.ceil(maxResults / 8), 3); i++) {
      await win.webContents.executeJavaScript('window.scrollBy(0, 700)')
      await new Promise((r) => setTimeout(r, 900))
    }

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const selectors = [
          '[data-controller="job-ad-item"]',
          '.m-jobsListItem',
          '[class*="jobsList"] article',
          '[class*="JobsList"] li',
          '[class*="job-ad-item"]',
          'article[class*="job"]'
        ];
        let cards = [];
        for (const sel of selectors) {
          cards = Array.from(document.querySelectorAll(sel));
          if (cards.length >= 2) break;
        }
        return cards.slice(0, ${maxResults}).map((card) => {
          const get = (sels) => { for (const s of sels) { const el = card.querySelector(s); if (el?.innerText?.trim()) return el.innerText.trim(); } return ''; };
          const linkEl = card.querySelector('a[href*="/jobs/"], a[href*="/job/"]') || card.querySelector('a[href]');
          const mailtoEl = card.querySelector('a[href^="mailto:"]');
          return {
            title: get(['h2', 'h3', '[class*="title"]', '[class*="Title"]', '[class*="position"]']),
            company: get(['[class*="company"]', '[class*="Company"]', '[class*="employer"]', '[class*="Employer"]']),
            location: get(['[class*="location"]', '[class*="Location"]', '[class*="city"]']),
            url: linkEl?.href || '',
            email: mailtoEl ? mailtoEl.href.replace('mailto:', '') : ''
          };
        }).filter(j => j.title);
      })()
    `).catch(() => [])

    if (!win.isDestroyed()) win.destroy()

    if (Array.isArray(jobs)) {
      for (const job of jobs) {
        if (results.length >= maxResults) break
        onProgress(results.length + 1, `Karriere.at: ${job.company || job.title}`)
        results.push({
          id: `ka-${results.length}`,
          company: job.company || 'Unknown',
          title: job.title,
          location: job.location || location,
          url: job.url || searchUrl,
          email: job.email || undefined,
          source: 'karriere'
        })
      }
    }
  } catch (err) {
    console.error('Karriere.at error:', err)
  }

  return results
}

// ─── LINKEDIN (Guest API — no login) ─────────────────────────────────────────
export async function scrapeLinkedIn(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const results: JobListing[] = []

  try {
    onProgress(0, 'Loading LinkedIn jobs...')

    // Try LinkedIn's public guest API first (no login needed)
    const guestApiUrl =
      `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` +
      `?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&start=0&count=${Math.min(maxResults, 25)}`

    let html = ''
    try {
      html = await fetchUrl(guestApiUrl, {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.9',
        Referer: 'https://www.linkedin.com/jobs/search/'
      })
    } catch {
      // ignore, fall through to browser
    }

    // Parse <li> HTML from guest API response
    if (html && html.includes('<li')) {
      const liMatch = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) || []
      for (const li of liMatch.slice(0, maxResults)) {
        const titleM = li.match(/class="[^"]*(?:result-card__title|base-search-card__title)[^"]*"[^>]*>([\s\S]*?)<\//)
          || li.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)
        const compM = li.match(/class="[^"]*(?:result-card__subtitle|base-search-card__subtitle)[^"]*"[^>]*>([\s\S]*?)<\//)
          || li.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)
        const urlM = li.match(/href="(https:\/\/[^"]*\/jobs\/view\/[^"?]*)/)
        const locM = li.match(/class="[^"]*(?:job-search-card__location|result-card__location)[^"]*"[^>]*>([\s\S]*?)<\//)

        const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : ''
        if (!title) continue
        const company = compM ? compM[1].replace(/<[^>]+>/g, '').trim() : ''
        const jobUrl = urlM ? urlM[1] : ''
        const jobLocation = locM ? locM[1].replace(/<[^>]+>/g, '').trim() : location

        onProgress(results.length + 1, `LinkedIn: ${company || title}`)
        results.push({
          id: `li-${results.length}`,
          company: company || 'Unknown',
          title,
          location: jobLocation,
          url: jobUrl,
          source: 'linkedin'
        })
        if (results.length >= maxResults) break
      }
    }

    // Fallback: BrowserWindow
    if (results.length === 0) {
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_TPR=r604800`
      const { win } = await loadPageInBrowser(searchUrl, 5000)

      await win.webContents.executeJavaScript('window.scrollBy(0, 1200)').catch(() => {})
      await new Promise((r) => setTimeout(r, 1500))

      const jobs = await win.webContents.executeJavaScript(`
        (function() {
          const cards = Array.from(document.querySelectorAll(
            '.base-card, .job-search-card, [data-entity-urn], .jobs-search__results-list > li'
          ));
          return cards.slice(0, ${maxResults}).map(card => ({
            title: (card.querySelector('.base-search-card__title, .job-search-card__title, h3') || {}).innerText?.trim() || '',
            company: (card.querySelector('.base-search-card__subtitle, .job-search-card__company-name, h4') || {}).innerText?.trim() || '',
            location: (card.querySelector('.job-search-card__location, .base-search-card__metadata') || {}).innerText?.trim() || '',
            url: (card.querySelector('a[href*="/jobs/view/"]') || card.querySelector('a[href*="linkedin.com/jobs"]') || {}).href || ''
          })).filter(j => j.title);
        })()
      `).catch(() => [])

      if (!win.isDestroyed()) win.destroy()

      if (Array.isArray(jobs)) {
        for (const job of jobs) {
          if (results.length >= maxResults) break
          onProgress(results.length + 1, `LinkedIn: ${job.company}`)
          results.push({ id: `li-${results.length}`, company: job.company || 'Unknown', title: job.title, location: job.location || location, url: job.url, source: 'linkedin' })
        }
      }
    }
  } catch (err) {
    console.error('LinkedIn error:', err)
  }

  return results
}

// ─── INDEED.AT ────────────────────────────────────────────────────────────────
export async function scrapeIndeed(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const results: JobListing[] = []

  try {
    const searchUrl = `https://at.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}`
    onProgress(0, 'Loading Indeed...')

    const { win } = await loadPageInBrowser(searchUrl, 3500)

    for (let i = 0; i < 2; i++) {
      await win.webContents.executeJavaScript('window.scrollBy(0, 800)')
      await new Promise((r) => setTimeout(r, 800))
    }

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll(
          '[data-jk], .job_seen_beacon, .resultContent, [class*="JobCard"]'
        ));
        return cards.slice(0, ${maxResults}).map(card => {
          const get = (sels) => { for (const s of sels) { const el = card.querySelector(s); if (el?.innerText?.trim()) return el.innerText.trim(); } return ''; };
          const titleEl = card.querySelector('h2 a, .jobTitle a, [data-testid="job-title"] a');
          const mailEl = card.querySelector('a[href^="mailto:"]');
          return {
            title: get(['h2 a span', 'h2 a', '.jobTitle a', '[data-testid="job-title"]', 'h2']),
            company: get(['[data-testid="company-name"]', '.companyName', '[class*="company"]']),
            location: get(['[data-testid="job-location"]', '.companyLocation', '[class*="location"]']),
            url: titleEl?.href || titleEl?.closest('a')?.href || '',
            email: mailEl ? mailEl.href.replace('mailto:', '') : ''
          };
        }).filter(j => j.title);
      })()
    `).catch(() => [])

    if (!win.isDestroyed()) win.destroy()

    if (Array.isArray(jobs)) {
      for (const job of jobs) {
        if (results.length >= maxResults) break
        onProgress(results.length + 1, `Indeed: ${job.company || job.title}`)
        results.push({
          id: `in-${results.length}`,
          company: job.company || 'Unknown',
          title: job.title,
          location: job.location || location,
          url: job.url ? (job.url.startsWith('http') ? job.url : `https://at.indeed.com${job.url}`) : searchUrl,
          email: job.email || undefined,
          source: 'indeed'
        })
      }
    }
  } catch (err) {
    console.error('Indeed error:', err)
  }

  return results
}

// ─── XING ─────────────────────────────────────────────────────────────────────
export async function scrapeXING(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const results: JobListing[] = []

  try {
    const searchUrl = `https://www.xing.com/jobs/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`
    onProgress(0, 'Loading XING...')

    const { win } = await loadPageInBrowser(searchUrl, 4000)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const selectors = ['[data-xds="JobCard"]','[class*="JobCard"]','[class*="job-card"]','article[class*="job"]','[class*="resultItem"]','[class*="ResultItem"]'];
        let cards = [];
        for (const s of selectors) { cards = Array.from(document.querySelectorAll(s)); if (cards.length >= 2) break; }
        return cards.slice(0, ${maxResults}).map(card => {
          const ta = card.querySelector('h2 a, h3 a, [class*="title"] a, [class*="Title"] a');
          const ca = card.querySelector('[class*="company"] a, [class*="Company"] a, [class*="employer"]');
          const la = card.querySelector('[class*="location"], [class*="Location"], [class*="city"]');
          return { title: ta?.innerText?.trim() || card.querySelector('h2,h3')?.innerText?.trim() || '', company: ca?.innerText?.trim() || '', location: la?.innerText?.trim() || '', url: ta?.href || '' };
        }).filter(j => j.title);
      })()
    `).catch(() => [])

    if (!win.isDestroyed()) win.destroy()

    if (Array.isArray(jobs)) {
      for (const job of jobs) {
        if (results.length >= maxResults) break
        onProgress(results.length + 1, `XING: ${job.company || job.title}`)
        results.push({ id: `xi-${results.length}`, company: job.company || 'Unknown', title: job.title, location: job.location || location, url: job.url || searchUrl, source: 'xing' })
      }
    }
  } catch (err) {
    console.error('XING error:', err)
  }

  return results
}

// ─── STEPSTONE.AT ─────────────────────────────────────────────────────────────
export async function scrapeStepStone(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const results: JobListing[] = []

  try {
    const searchUrl = `https://www.stepstone.at/jobs/suche/?q=${encodeURIComponent(keyword)}&where=${encodeURIComponent(location)}`
    onProgress(0, 'Loading StepStone...')

    const { win } = await loadPageInBrowser(searchUrl, 3500)

    for (let i = 0; i < 2; i++) {
      await win.webContents.executeJavaScript('window.scrollBy(0, 800)')
      await new Promise((r) => setTimeout(r, 700))
    }

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const selectors = ['[data-at="job-item"]','article[class*="job"]','[class*="listing-item"]','[class*="JobCard"]','[class*="job-item"]'];
        let cards = [];
        for (const s of selectors) { cards = Array.from(document.querySelectorAll(s)); if (cards.length >= 2) break; }
        return cards.slice(0, ${maxResults}).map(card => {
          const titleEl = card.querySelector('[data-at="job-item-title"], h2 a, h3 a, [class*="title"] a');
          const compEl = card.querySelector('[data-at="job-item-company-name"], [class*="company"]');
          const locEl = card.querySelector('[data-at="job-item-location"], [class*="location"]');
          const linkEl = card.querySelector('a[href*="/job/"], a[href*="/stellenangebote/"]') || card.querySelector('a[href]');
          return { title: titleEl?.innerText?.trim() || card.querySelector('h2,h3')?.innerText?.trim() || '', company: compEl?.innerText?.trim() || '', location: locEl?.innerText?.trim() || '', url: (titleEl?.href || linkEl?.href || '').split('?')[0] };
        }).filter(j => j.title);
      })()
    `).catch(() => [])

    if (!win.isDestroyed()) win.destroy()

    if (Array.isArray(jobs)) {
      for (const job of jobs) {
        if (results.length >= maxResults) break
        onProgress(results.length + 1, `StepStone: ${job.company || job.title}`)
        results.push({ id: `ss-${results.length}`, company: job.company || 'Unknown', title: job.title, location: job.location || location, url: job.url || searchUrl, source: 'stepstone' })
      }
    }
  } catch (err) {
    console.error('StepStone error:', err)
  }

  return results
}

// ─── Email extraction from company page ───────────────────────────────────────
export async function extractEmailFromJobPage(url: string): Promise<string | undefined> {
  if (!url) return undefined

  // Fast HTTP fetch first
  try {
    const html = await fetchUrl(url)
    const text = html.replace(/<[^>]+>/g, ' ')
    const emails = extractAllEmails(text)
    const best = pickBestEmail(emails)
    if (best) return best
  } catch {
    // fall through to browser
  }

  // Browser fallback for JS-rendered pages
  const { win } = await loadPageInBrowser(url, 2500)
  try {
    const text = await win.webContents.executeJavaScript('document.body.innerText').catch(() => '')
    const emails = extractAllEmails(text)
    const best = pickBestEmail(emails)
    if (best) {
      if (!win.isDestroyed()) win.destroy()
      return best
    }

    // Check contact/impressum sub-pages
    const contactLinks = await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('a[href]'))
        .filter(a => /contact|kontakt|impressum|career|jobs|bewerbung/i.test(a.href + a.textContent))
        .map(a => a.href).filter(h => h.startsWith('http')).slice(0, 3)
    `).catch(() => []) as string[]

    if (!win.isDestroyed()) win.destroy()

    for (const cUrl of contactLinks) {
      try {
        const { text: ct, win: cw } = await loadPageInBrowser(cUrl, 2000)
        const ce = extractAllEmails(ct)
        if (!cw.isDestroyed()) cw.destroy()
        const best2 = pickBestEmail(ce)
        if (best2) return best2
      } catch {
        continue
      }
    }
  } catch {
    if (!win.isDestroyed()) win.destroy()
  }

  return undefined
}
