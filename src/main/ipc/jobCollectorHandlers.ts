import { ipcMain } from 'electron'
import { collectJobsVisible } from '../services/jobCollectorService'
import type { CollectedJob } from '../services/jobCollectorService'

export function registerJobCollectorHandlers(): void {
  ipcMain.handle(
    'collector:start',
    async (
      event,
      params: { keyword: string; location: string; maxResults: number; sources: string[] }
    ) => {
      const jobs: CollectedJob[] = []

      await collectJobsVisible(
        params.keyword,
        params.location,
        params.maxResults,
        params.sources,
        (job) => {
          jobs.push(job)
          if (!event.sender.isDestroyed()) {
            event.sender.send('collector:job', job)
          }
        },
        () => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('collector:done', { total: jobs.length })
          }
        }
      )

      return jobs
    }
  )
}
