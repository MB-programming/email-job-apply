import { ipcMain, shell } from 'electron'
import {
  exportCVToPDF,
  exportCVToImage,
  exportCVToWord,
  exportJobsToExcel,
  exportJobsToWord
} from '../services/exportService'
import type { CVData, JobRow } from '../services/exportService'

export function registerExportHandlers(): void {
  ipcMain.handle('export:cv-pdf', async (_, htmlContent: string) => {
    const result = await exportCVToPDF(htmlContent)
    if (result.success && result.path) shell.openPath(result.path)
    return result
  })

  ipcMain.handle('export:cv-image', async (_, htmlContent: string) => {
    const result = await exportCVToImage(htmlContent)
    if (result.success && result.path) shell.showItemInFolder(result.path)
    return result
  })

  ipcMain.handle('export:cv-word', async (_, cv: CVData) => {
    const result = await exportCVToWord(cv)
    if (result.success && result.path) shell.openPath(result.path)
    return result
  })

  ipcMain.handle('export:jobs-excel', async (_, jobs: JobRow[]) => {
    const result = await exportJobsToExcel(jobs)
    if (result.success && result.path) shell.openPath(result.path)
    return result
  })

  ipcMain.handle('export:jobs-word', async (_, jobs: JobRow[]) => {
    const result = await exportJobsToWord(jobs)
    if (result.success && result.path) shell.openPath(result.path)
    return result
  })
}
