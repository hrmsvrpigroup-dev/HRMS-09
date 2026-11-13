import { google } from 'googleapis'
import { prisma } from '../config/database'

/**
 * Validates whether the given string represents a valid PEM private key.
 */
function isValidPrivateKey(key: string | undefined): boolean {
  if (!key || typeof key !== 'string') return false
  const trimmed = key.trim()
  if (trimmed === 'value' || trimmed === '""' || trimmed === "''" || trimmed.length < 50) return false
  return trimmed.includes('BEGIN PRIVATE KEY') || trimmed.includes('BEGIN RSA PRIVATE KEY')
}

/**
 * Normalizes PEM private keys from env vars (removes outer quotes and handles escaped newlines).
 */
function normalizePrivateKey(key: string): string {
  let cleaned = key.trim()
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\r/g, '')
  return cleaned
}

/**
 * Helper to fetch with retry and exponential backoff.
 */
async function fetchWithRetry(url: string, options: any, retries = 3, backoffMs = 500): Promise<Response> {
  let lastErr: any
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res
      throw new Error(`HTTP status ${res.status}`)
    } catch (err: any) {
      lastErr = err
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, i)))
      }
    }
  }
  throw lastErr
}

/**
 * Synchronizes attendance details to Google Sheets.
 * Tab Name = Shift Date (e.g. YYYY-MM-DD)
 * Header Columns:
 * Code | Employee Name | Shift Date | Clock In | Clock Out | Total Hours | Active Hours | Idle Time | Status | Continue | Actions
 */
export async function syncAttendanceToGoogleSheet(attendanceId: string): Promise<void> {
  try {
    const record = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        employee: true,
      },
    })

    if (!record || !record.employee) {
      console.warn(`[GOOGLE_SHEET_SYNC] Attendance record or employee not found for ID: ${attendanceId}`)
      return
    }

    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    let privateKey = process.env.GOOGLE_PRIVATE_KEY

    // Derive date string for sheet tab name (e.g. "2026-08-20")
    const shiftDateObj = record.date ? new Date(record.date) : new Date()
    const shiftDateTabName = record.date instanceof Date
      ? record.date.toISOString().split('T')[0]
      : (shiftDateObj ? shiftDateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0])

    // Formatted details
    const code = record.employee.employeeCode || 'N/A'
    const empName = `${record.employee.firstName || ''} ${record.employee.lastName || ''}`.trim()
    const shiftDateFormatted = shiftDateObj.toLocaleDateString('en-US')
    const clockInStr = record.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US') : '--'
    const clockOutStr = record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US') : '--'
    const totalHoursStr = record.totalHours != null ? `${record.totalHours} hrs` : '--'

    // Compute Active Working Hours accurately
    let activeHrsVal: number | null = null
    if (record.totalHours != null) {
      activeHrsVal = Math.max(0, record.totalHours - (record.idleMinutes / 60))
    } else if (record.clockIn && !record.clockOut) {
      const diffMs = new Date().getTime() - new Date(record.clockIn).getTime()
      const elapsedHrs = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100
      activeHrsVal = Math.max(0, elapsedHrs - (record.idleMinutes / 60))
    }
    const activeHoursStr = activeHrsVal != null ? `${activeHrsVal.toFixed(2)} hrs` : '--'

    const idleTimeStr = record.idleMinutes > 0 ? `${record.idleMinutes} min` : '--'
    const statusStr = record.status || 'PRESENT'
    const continueStr = record.clockOut ? '--' : (record.clockIn ? 'In Progress' : '--')
    const actionsStr = record.clockOut ? 'COMPLETED' : (record.clockIn ? 'ACTIVE' : '--')

    const rowData = [
      code,
      empName,
      shiftDateFormatted,
      clockInStr,
      clockOutStr,
      totalHoursStr,
      activeHoursStr,
      idleTimeStr,
      statusStr,
      continueStr,
      actionsStr,
    ]

    // 1. Google Apps Script Webhook Sync (if GOOGLE_SHEET_WEBHOOK_URL is provided)
    if (webhookUrl && webhookUrl.trim().length > 0) {
      try {
        const response = await fetchWithRetry(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert_attendance',
            tabName: shiftDateTabName,
            employeeCode: code,
            row: rowData,
          }),
        }, 3, 500)
        console.log(`[GOOGLE_SHEET_WEBHOOK] Synced employee ${code} for tab ${shiftDateTabName}, status: ${response.status}`)
      } catch (webhookErr: any) {
        console.error(`[GOOGLE_SHEET_WEBHOOK_ERROR] Failed after retries: ${webhookErr.message}`)
      }
    }

    // 2. Google Sheets API Service Account Sync (if GOOGLE_SHEET_ID, valid EMAIL, and valid PEM KEY are provided)
    const hasValidKey = isValidPrivateKey(privateKey)
    const hasValidEmail = Boolean(clientEmail && clientEmail.trim() !== 'value' && clientEmail.includes('@'))
    const hasValidSheetId = Boolean(spreadsheetId && spreadsheetId.trim() !== 'value')

    if (hasValidSheetId && hasValidEmail && hasValidKey) {
      try {
        const formattedKey = normalizePrivateKey(privateKey!)

        const auth = new google.auth.JWT(
          clientEmail,
          undefined,
          formattedKey,
          ['https://www.googleapis.com/auth/spreadsheets']
        )

        const sheets = google.sheets({ version: 'v4', auth })

        // Check existing tabs
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
        const existingSheets = spreadsheet.data.sheets || []
        const sheetExists = existingSheets.some(
          (s: any) => s.properties?.title === shiftDateTabName
        )

        const headers = [
          'Code',
          'Employee Name',
          'Shift Date',
          'Clock In',
          'Clock Out',
          'Total Hours',
          'Active Hours',
          'Idle Time',
          'Status',
          'Continue',
          'Actions',
        ]

        // Automatically create tab for today's date if it does not exist yet
        if (!sheetExists) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: shiftDateTabName,
                    },
                  },
                },
              ],
            },
          })

          // Add Header Row
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${shiftDateTabName}'!A1:K1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [headers],
            },
          })
          console.log(`[GOOGLE_SHEET_SYNC] Created tab '${shiftDateTabName}' with headers.`)
        }

        // Fetch existing rows in tab to check if employee row already exists
        const readRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${shiftDateTabName}'!A:K`,
        })

        const rows = readRes.data.values || []
        let existingRowIndex = -1

        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === code) {
            existingRowIndex = i + 1 // 1-indexed row number
            break
          }
        }

        if (existingRowIndex > 0) {
          // Update existing row
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${shiftDateTabName}'!A${existingRowIndex}:K${existingRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [rowData],
            },
          })
          console.log(`[GOOGLE_SHEET_SYNC] Updated employee ${code} row ${existingRowIndex} in tab '${shiftDateTabName}'.`)
        } else {
          // Append new row
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${shiftDateTabName}'!A:K`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [rowData],
            },
          })
          console.log(`[GOOGLE_SHEET_SYNC] Appended employee ${code} to tab '${shiftDateTabName}'.`)
        }
      } catch (apiErr: any) {
        console.error(`[GOOGLE_SHEETS_API_ERROR] ${apiErr.message}`)
      }
    }
  } catch (error: any) {
    console.error(`[GOOGLE_SHEETS_SYNC_GLOBAL_ERROR] ${error.message}`)
  }
}

/**
 * Synchronizes all existing attendance records in the database to Google Sheets
 * ensuring zero data loss.
 */
export async function syncAllAttendanceToGoogleSheet(tenantId?: string): Promise<{ total: number; synced: number }> {
  try {
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY

    const hasWebhook = Boolean(webhookUrl && webhookUrl.trim().length > 0 && webhookUrl.trim() !== 'value')
    const hasServiceAccount = Boolean(
      spreadsheetId && spreadsheetId.trim() !== 'value' &&
      clientEmail && clientEmail.trim() !== 'value' &&
      isValidPrivateKey(privateKey)
    )

    if (!hasWebhook && !hasServiceAccount) {
      console.log('[GOOGLE_SHEETS_BACKFILL] Google Sheets credentials not configured; skipping backfill.')
      return { total: 0, synced: 0 }
    }

    const whereClause: any = {}
    if (tenantId) whereClause.tenantId = tenantId

    // When running general sync without specific tenantId, sync recent records (last 7 days)
    // to prevent memory exhaustion and rate limiting on 6,800+ historical records.
    if (!tenantId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      whereClause.date = { gte: sevenDaysAgo }
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      select: { id: true },
      orderBy: { date: 'asc' },
    })

    console.log(`[GOOGLE_SHEETS_BACKFILL] Found ${records.length} attendance records to sync to Google Sheets...`)
    let synced = 0
    let consecutiveErrors = 0

    for (const rec of records) {
      try {
        await syncAttendanceToGoogleSheet(rec.id)
        synced++
        consecutiveErrors = 0
        // Small delay to prevent hitting Google API quotas
        await new Promise((resolve) => setTimeout(resolve, 50))
      } catch (err: any) {
        consecutiveErrors++
        console.error(`[GOOGLE_SHEETS_BACKFILL_ERROR] Failed for record ID ${rec.id}: ${err.message}`)
        if (consecutiveErrors >= 5) {
          console.warn('[GOOGLE_SHEETS_BACKFILL] Aborting backfill loop after 5 consecutive errors to maintain service health.')
          break
        }
      }
    }
    console.log(`[GOOGLE_SHEETS_BACKFILL] Successfully backfilled ${synced}/${records.length} records to Google Sheets.`)
    return { total: records.length, synced }
  } catch (error: any) {
    console.error(`[GOOGLE_SHEETS_BACKFILL_GLOBAL_ERROR] ${error.message}`)
    return { total: 0, synced: 0 }
  }
}

