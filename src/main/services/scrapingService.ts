import { BrowserWindow } from 'electron'

export interface JobListing {
  id: string
  company: string
  title: string
  location: string
  url: string
  email?: string
  source: 'linkedin' | 'indeed' | 'xing' | 'stepstone'
  description?: string
}

export type ScrapingSource = 'linkedin' | 'indeed' | 'xing' | 'stepstone'

const DELAYS: Record<string, number> = {
  linkedin: 3000,
  indeed: 2000,
  xing: 2500,
  stepstone: 2000
}

async function loadPage(
  win: BrowserWindow,
  url: string,
  waitMs: number
): Promise<void> {
  await win.loadURL(url, {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })
  await new Promise((r) => setTimeout(r, waitMs))
}

// Extract email from text using regex
function extractEmail(text: string): string | undefined {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i)
  return match?.[0]
}

// Try to find contact email on company career/contact page
async function findCompanyEmail(
  win: BrowserWindow,
  companyUrl: string
): Promise<string | undefined> {
  try {
    const urlsToTry = [
      companyUrl.replace(/\/$/, '') + '/contact',
      companyUrl.replace(/\/$/, '') + '/careers',
      companyUrl.replace(/\/$/, '') + '/jobs'
    ]
    for (const url of urlsToTry) {
      try {
        await loadPage(win, url, 1500)
        const text = await win.webContents.executeJavaScript('document.body.innerText')
        const email = extractEmail(text)
        if (email && !email.includes('example') && !email.includes('your@')) return email
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return undefined
}

export async function scrapeLinkedIn(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { javascript: true, images: false, nodeIntegration: false, contextIsolation: true }
  })

  const results: JobListing[] = []

  try {
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_TPR=r604800`
    onProgress(0, 'Loading LinkedIn...')

    await loadPage(win, searchUrl, DELAYS.linkedin)

    const isLoggedOut = await win.webContents.executeJavaScript(
      'document.querySelector(".sign-in-form") !== null || document.title.toLowerCase().includes("sign in")'
    )

    if (isLoggedOut) {
      // Show window for user to log in
      win.show()
      win.setTitle('LinkedIn — Please log in, then close this window')
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          try {
            const stillLoggedOut = await win.webContents.executeJavaScript(
              'document.querySelector(".sign-in-form") !== null'
            )
            if (!stillLoggedOut) {
              clearInterval(checkInterval)
              win.hide()
              resolve()
            }
          } catch {
            clearInterval(checkInterval)
            resolve()
          }
        }, 2000)
        win.once('closed', () => {
          clearInterval(checkInterval)
          resolve()
        })
      })

      if (win.isDestroyed()) return results
      await loadPage(win, searchUrl, DELAYS.linkedin)
    }

    // Scroll to load more results
    const scrollPasses = Math.ceil(maxResults / 10)
    for (let i = 0; i < Math.min(scrollPasses, 5); i++) {
      await win.webContents.executeJavaScript('window.scrollBy(0, 800)')
      await new Promise((r) => setTimeout(r, 1500))
    }

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll('.job-search-card, .jobs-search__results-list li, [data-entity-urn]'));
        return cards.slice(0, ${maxResults}).map((card, i) => {
          const titleEl = card.querySelector('.job-search-card__title, .base-search-card__title, h3');
          const companyEl = card.querySelector('.job-search-card__company-name, .base-search-card__subtitle, h4');
          const locationEl = card.querySelector('.job-search-card__location, .base-search-card__metadata');
          const linkEl = card.querySelector('a[href*="/jobs/view/"], a[href*="linkedin.com/jobs"]');
          return {
            title: titleEl?.innerText?.trim() || '',
            company: companyEl?.innerText?.trim() || '',
            location: locationEl?.innerText?.trim() || '',
            url: linkEl?.href || ''
          };
        }).filter(j => j.title && j.company);
      })()
    `)

    if (Array.isArray(jobs)) {
      for (let i = 0; i < Math.min(jobs.length, maxResults); i++) {
        const job = jobs[i]
        onProgress(i + 1, `Found: ${job.company}`)
        results.push({
          id: `li-${i}`,
          company: job.company,
          title: job.title,
          location: job.location,
          url: job.url,
          source: 'linkedin'
        })
      }
    }
  } catch (err) {
    console.error('LinkedIn scraping error:', err)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }

  return results
}

export async function scrapeIndeed(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { javascript: true, images: false, nodeIntegration: false, contextIsolation: true }
  })

  const results: JobListing[] = []

  try {
    const searchUrl = `https://at.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}`
    onProgress(0, 'Loading Indeed...')
    await loadPage(win, searchUrl, DELAYS.indeed)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll('[data-jk], .job_seen_beacon, .resultContent'));
        return cards.slice(0, ${maxResults}).map((card, i) => {
          const titleEl = card.querySelector('h2 a, .jobTitle a, [data-testid="job-title"]');
          const companyEl = card.querySelector('[data-testid="company-name"], .companyName, span[class*="company"]');
          const locationEl = card.querySelector('[data-testid="job-location"], .companyLocation');
          const emailEl = card.querySelector('a[href^="mailto:"]');
          return {
            title: titleEl?.innerText?.trim() || titleEl?.getAttribute('aria-label') || '',
            company: companyEl?.innerText?.trim() || '',
            location: locationEl?.innerText?.trim() || '',
            url: titleEl?.href || '',
            email: emailEl ? emailEl.href.replace('mailto:', '') : ''
          };
        }).filter(j => j.title && j.company);
      })()
    `)

    if (Array.isArray(jobs)) {
      for (let i = 0; i < Math.min(jobs.length, maxResults); i++) {
        const job = jobs[i]
        onProgress(i + 1, `Found: ${job.company}`)
        results.push({
          id: `in-${i}`,
          company: job.company,
          title: job.title,
          location: job.location,
          url: job.url,
          email: job.email || undefined,
          source: 'indeed'
        })
      }
    }
  } catch (err) {
    console.error('Indeed scraping error:', err)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }

  return results
}

export async function scrapeXING(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { javascript: true, images: false, nodeIntegration: false, contextIsolation: true }
  })

  const results: JobListing[] = []

  try {
    const searchUrl = `https://www.xing.com/jobs/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`
    onProgress(0, 'Loading XING...')
    await loadPage(win, searchUrl, DELAYS.xing)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll('[data-xds="JobCard"], .jobs-job-listing-item, article'));
        return cards.slice(0, ${maxResults}).map((card, i) => {
          const titleEl = card.querySelector('h2, h3, [class*="title"], [class*="jobTitle"]');
          const companyEl = card.querySelector('[class*="company"], [class*="employer"]');
          const locationEl = card.querySelector('[class*="location"], [class*="city"]');
          const linkEl = card.querySelector('a[href*="/jobs/"]');
          return {
            title: titleEl?.innerText?.trim() || '',
            company: companyEl?.innerText?.trim() || '',
            location: locationEl?.innerText?.trim() || '',
            url: linkEl?.href || ''
          };
        }).filter(j => j.title && j.company);
      })()
    `)

    if (Array.isArray(jobs)) {
      for (let i = 0; i < Math.min(jobs.length, maxResults); i++) {
        const job = jobs[i]
        onProgress(i + 1, `Found: ${job.company}`)
        results.push({
          id: `xi-${i}`,
          company: job.company,
          title: job.title,
          location: job.location,
          url: job.url,
          source: 'xing'
        })
      }
    }
  } catch (err) {
    console.error('XING scraping error:', err)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }

  return results
}

export async function scrapeStepStone(
  keyword: string,
  location: string,
  maxResults: number,
  onProgress: (found: number, msg: string) => void
): Promise<JobListing[]> {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { javascript: true, images: false, nodeIntegration: false, contextIsolation: true }
  })

  const results: JobListing[] = []

  try {
    const searchUrl = `https://www.stepstone.at/jobs/${encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, '-'))}/in-${encodeURIComponent(location.toLowerCase().replace(/\s+/g, '-'))}`
    onProgress(0, 'Loading StepStone...')
    await loadPage(win, searchUrl, DELAYS.stepstone)

    const jobs = await win.webContents.executeJavaScript(`
      (function() {
        const cards = Array.from(document.querySelectorAll('[data-at="job-item"], .listing-item, article[class*="job"]'));
        return cards.slice(0, ${maxResults}).map((card, i) => {
          const titleEl = card.querySelector('h2, h3, [data-at="job-item-title"]');
          const companyEl = card.querySelector('[data-at="job-item-company-name"], [class*="company"]');
          const locationEl = card.querySelector('[data-at="job-item-location"], [class*="location"]');
          const linkEl = card.querySelector('a');
          return {
            title: titleEl?.innerText?.trim() || '',
            company: companyEl?.innerText?.trim() || '',
            location: locationEl?.innerText?.trim() || '',
            url: linkEl?.href || ''
          };
        }).filter(j => j.title && j.company);
      })()
    `)

    if (Array.isArray(jobs)) {
      for (let i = 0; i < Math.min(jobs.length, maxResults); i++) {
        const job = jobs[i]
        onProgress(i + 1, `Found: ${job.company}`)
        results.push({
          id: `ss-${i}`,
          company: job.company,
          title: job.title,
          location: job.location,
          url: job.url,
          source: 'stepstone'
        })
      }
    }
  } catch (err) {
    console.error('StepStone scraping error:', err)
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }

  return results
}

// Try to extract email from a job detail page
export async function extractEmailFromJobPage(url: string): Promise<string | undefined> {
  if (!url) return undefined
  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: true, images: false, nodeIntegration: false, contextIsolation: true }
  })
  try {
    await loadPage(win, url, 2000)
    const text = await win.webContents.executeJavaScript('document.body.innerText')
    return extractEmail(text)
  } catch {
    return undefined
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}
