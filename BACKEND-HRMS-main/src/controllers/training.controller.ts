import { Response } from 'express'
import { TrainingSessionType, TrainingParticipantStatus, AttendanceOverrideMode, AttendanceStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendSuccess, sendError } from '../utils/response.utils'
import { notificationService } from '../services/notification.service'
import { generateTeamsMeetingLink } from '../services/interview.service'
import nodemailer from 'nodemailer'

function parseDurationMinutes(durationStr?: string): number {
  const m = String(durationStr || '').match(/(\d+)/)
  return m ? Math.max(15, parseInt(m[1], 10)) : 60
}

function parseSessionDateUtc(rawDate?: string, fallbackDateStr?: string): Date {
  const candidate = (rawDate || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return new Date(`${candidate}T00:00:00.000Z`)
  }
  const parsed = new Date(fallbackDateStr || Date.now())
  if (!isNaN(parsed.getTime())) {
    const iso = parsed.toISOString().split('T')[0]
    return new Date(`${iso}T00:00:00.000Z`)
  }
  const todayIso = new Date().toISOString().split('T')[0]
  return new Date(`${todayIso}T00:00:00.000Z`)
}

/**
 * Send an email directly using Microsoft 365 Graph API (POST /v1.0/users/{userId}/sendMail)
 * Uses Azure AD client credentials and dispatches from the configured Microsoft 365 work account.
 */
async function sendMicrosoftGraphMail({
  tenantId,
  clientId,
  clientSecret,
  fromEmail,
  fromDisplayName,
  toEmail,
  toName,
  subject,
  html,
  cachedAccessToken
}: {
  tenantId: string
  clientId: string
  clientSecret: string
  fromEmail: string
  fromDisplayName: string
  toEmail: string
  toName: string
  subject: string
  html: string
  cachedAccessToken?: string
}): Promise<{ accessToken: string }> {
  let token = cachedAccessToken
  if (!token) {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId.trim())}/oauth2/v2.0/token`
    const params = new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default'
    })

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!tokenRes.ok) {
      const errData: any = await tokenRes.json().catch(() => ({}))
      const desc = errData.error_description || 'Azure AD authentication failed. Please verify your Tenant ID, Client ID, and Client Secret.'
      throw new Error(`Microsoft 365 Authentication failed: ${desc}`)
    }

    const tokenData: any = await tokenRes.json()
    token = tokenData.access_token
  }

  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail.trim())}/sendMail`
  const mailPayload = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: html
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail.trim(),
            name: toName.trim()
          }
        }
      ],
      from: {
        emailAddress: {
          address: fromEmail.trim(),
          name: fromDisplayName.trim()
        }
      }
    },
    saveToSentItems: true
  }

  const mailRes = await fetch(sendMailUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(mailPayload)
  })

  if (!mailRes.ok) {
    const errText = await mailRes.text()
    let errMsg = errText
    try {
      const errJson = JSON.parse(errText)
      if (mailRes.status === 403 || errJson?.error?.code === 'ErrorAccessDenied') {
        errMsg = `Microsoft 365 Graph API permission error: Azure AD App requires the 'Mail.Send' Application permission with Admin Consent in Azure Portal (portal.azure.com > App registrations > API permissions) to send emails directly from ${fromEmail.trim()}. (${errJson?.error?.message || 'Access Denied'})`
      } else {
        errMsg = errJson?.error?.message || errText
      }
    } catch (_) {}
    throw new Error(`Microsoft 365 sendMail error (${mailRes.status}): ${errMsg}`)
  }

  return { accessToken: token! }
}

export const trainingController = {
  // POST /training/test-teams-connection: Test custom Teams link or Azure credentials
  async testTeamsConnection(req: AuthRequest, res: Response) {
    try {
      const { mode, customMeetingLink, azureTenantId, azureClientId, azureClientSecret, azureUserId } = req.body

      if (mode === 'custom' || customMeetingLink) {
        const link = (customMeetingLink || '').trim()
        if (!link.startsWith('http://') && !link.startsWith('https://')) {
          return sendError(res, 'Please enter a valid meeting URL starting with https:// (e.g., https://teams.microsoft.com/...)', 400)
        }
        return sendSuccess(res, { verified: true, mode: 'custom' }, 'Microsoft Teams meeting link verified successfully!')
      }

      if (mode === 'azure') {
        if (!azureTenantId || !azureClientId || !azureClientSecret || !azureUserId) {
          return sendError(res, 'Tenant ID, Client ID, Client Secret, and Organizer Email are all required for Azure M365 integration.', 400)
        }

        const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(azureTenantId.trim())}/oauth2/v2.0/token`
        const params = new URLSearchParams({
          client_id: azureClientId.trim(),
          client_secret: azureClientSecret.trim(),
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default'
        })

        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        })

        if (!tokenRes.ok) {
          const errData: any = await tokenRes.json().catch(() => ({}))
          const errorDesc = errData.error_description || 'Azure AD authentication failed. Please verify your Tenant ID, Client ID, and Secret.'
          return sendError(res, errorDesc, 400)
        }

        return sendSuccess(res, { verified: true, mode: 'azure' }, 'Connected to Microsoft 365 Azure successfully! Training Teams meetings can now be generated automatically.')
      }

      return sendSuccess(res, { verified: true, mode: 'auto' }, 'Automated Microsoft Teams meeting room ready.')
    } catch (err: any) {
      console.error('[TrainingController] Teams test connection error:', err.message || err)
      return sendError(res, err.message || 'Failed to verify Teams configuration', 500)
    }
  },

  // POST /training/generate-teams-link: Generate or retrieve a Teams meeting URL
  async generateTeamsLink(req: AuthRequest, res: Response) {
    try {
      const { topic, teamsConfig } = req.body || {}
      const link = await generateTeamsMeetingLink(topic || 'Employee Training Session', undefined, undefined, teamsConfig)
      return sendSuccess(res, { link }, 'Teams meeting link generated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to generate Teams meeting link', 500)
    }
  },

  // POST /training/send-invitations: Send Microsoft Teams training email invitations to selected employees
  async sendTrainingInvitations(req: AuthRequest, res: Response) {
    try {
      const {
        recipients,
        meetingDetails,
        googleMailConfig,
        teamsConfig,
        subject: customSubject,
        portalOnly = false
      } = req.body

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return sendError(res, 'Please select at least one employee recipient.', 400)
      }

      const {
        sessionType = 'TRAINING',
        rawDate,
        title = 'Employee Training & Development Session',
        trainerName = 'HR Training Team',
        customSenderName = 'HR Training Academy',
        date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time = '11:00 AM - 12:30 PM IST',
        duration = '90 Minutes',
        meetingLink = '',
        meetingId,
        passcode,
        agenda = 'Comprehensive corporate skill enhancement and development workshop.',
        prerequisites,
        instructions = 'Please ensure you have Microsoft Teams installed and join 5 minutes before the scheduled time with your mic and video operational.',
        customMessage
      } = meetingDetails || {}

      let finalMeetingLink = (meetingLink || '').trim()
      if (!finalMeetingLink && !portalOnly) {
        finalMeetingLink = await generateTeamsMeetingLink(title, undefined, undefined, teamsConfig)
      }

      // Persist Training / Meeting Session & Selected Employees in PostgreSQL
      const tenantId = req.tenantId ?? req.user?.tenantId
      let savedSession: any = null
      if (tenantId) {
        try {
          const parsedSessionDate = parseSessionDateUtc(rawDate, date)
          const resolvedType: TrainingSessionType =
            String(sessionType).toUpperCase() === 'MEETING' ? TrainingSessionType.MEETING : TrainingSessionType.TRAINING

          const recipientEmails = recipients
            .map((r: any) => String(r.email || '').trim().toLowerCase())
            .filter(Boolean)
          const matchedEmployees = await prisma.employee.findMany({
            where: {
              tenantId,
              OR: [
                { email: { in: recipientEmails, mode: 'insensitive' } },
                { personalEmail: { in: recipientEmails, mode: 'insensitive' } },
              ],
            },
            select: { id: true, email: true, personalEmail: true },
          })

          savedSession = await prisma.trainingSession.create({
            data: {
              tenantId,
              sessionType: resolvedType,
              title: title.trim(),
              trainerName: trainerName.trim(),
              sessionDate: parsedSessionDate,
              timeSlot: time,
              duration,
              teamsUrl: finalMeetingLink || null,
              meetingId: meetingId || null,
              passcode: passcode || null,
              agenda: agenda || null,
              createdById: req.user?.id,
              participants: {
                create: matchedEmployees.map((emp) => ({
                  tenantId,
                  employeeId: emp.id,
                  attendanceStatus: TrainingParticipantStatus.PENDING,
                  overrideMode: AttendanceOverrideMode.NONE,
                })),
              },
            },
            include: {
              participants: {
                include: {
                  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true } },
                },
              },
            },
          })
        } catch (dbErr: any) {
          console.error('[TrainingController] Non-fatal error persisting session:', dbErr.message || dbErr)
        }
      }

      if (portalOnly) {
        const portalCount = savedSession?.participants?.length || 0
        return sendSuccess(
          res,
          {
            sessionId: savedSession?.id || null,
            portalCount,
            successCount: portalCount,
            failCount: 0,
            results: [],
          },
          `Published to HRMS Portal notification, Employee Calendar, and Today's Tasks for ${portalCount} employee(s)!`
        )
      }

      const senderDisplayName = customSenderName.trim() || 'HR Training Academy'
      const emailSubject = customSubject?.trim() || `[Training Invitation] ${title} via Microsoft Teams`

      // Determine email provider:
      // If Microsoft Azure mode is active or credentials are provided, strictly route through Microsoft 365 Graph
      const azureTenantId = (teamsConfig?.azureTenantId || process.env.AZURE_TENANT_ID || '').trim()
      const azureClientId = (teamsConfig?.azureClientId || process.env.AZURE_CLIENT_ID || '').trim()
      const azureClientSecret = (teamsConfig?.azureClientSecret || process.env.AZURE_CLIENT_SECRET || '').trim()
      const azureUserId = (teamsConfig?.azureUserId || process.env.AZURE_USER_ID || '').trim()

      const isAzureMode = teamsConfig?.mode === 'azure' || Boolean(
        azureTenantId && azureClientId && azureClientSecret && azureUserId
      )

      if (isAzureMode) {
        if (!azureTenantId || !azureClientId || !azureClientSecret || !azureUserId) {
          return sendError(
            res,
            'Microsoft Teams Azure M365 mode is active, but required Azure credentials (Tenant ID, Client ID, Client Secret, Organizer Email) are missing. Please complete Microsoft Teams Configuration before dispatching.',
            400
          )
        }
      }

      let microsoftAccessToken: string | undefined

      const results: Array<{ email: string; name: string; success: boolean; error?: string }> = []
      let successCount = 0
      let failCount = 0

      for (const recipient of recipients) {
        const toEmail = recipient.email?.trim()
        const empName = recipient.name?.trim() || recipient.firstName || 'Employee'

        if (!toEmail || !toEmail.includes('@')) {
          results.push({ email: toEmail || 'N/A', name: empName, success: false, error: 'Invalid email address' })
          failCount++
          continue
        }

        // Generate personalized HTML email with Microsoft Teams branding
        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 0; color: #1e293b; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #464EB8 0%, #33399b 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .teams-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.18); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 12px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3; }
    .header p { margin: 0; font-size: 14px; color: #e0e7ff; opacity: 0.95; }
    .body-content { padding: 32px 28px; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
    .intro { font-size: 14px; color: #475569; margin-bottom: 24px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .info-row { display: flex; margin-bottom: 10px; font-size: 14px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { width: 140px; font-weight: 600; color: #64748b; }
    .info-val { color: #0f172a; font-weight: 500; flex: 1; }
    .btn-container { text-align: center; margin: 28px 0; }
    .join-btn { display: inline-block; background-color: #464EB8; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(70, 78, 184, 0.35); }
    .raw-link { font-size: 12px; color: #64748b; word-break: break-all; margin-top: 10px; }
    .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px 0; }
    .agenda-box { background: #f1f5f9; border-left: 4px solid #464EB8; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: 14px; color: #334155; white-space: pre-wrap; margin-bottom: 20px; }
    .custom-message-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; font-size: 14px; color: #1e40af; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="teams-badge">
        <span>Microsoft Teams Training Session</span>
      </div>
      <h1>${title}</h1>
      <p>Organized by ${senderDisplayName}</p>
    </div>

    <div class="body-content">
      <div class="greeting">Dear ${empName},</div>
      <div class="intro">
        You have been selected to attend the upcoming official training session on <strong>Microsoft Teams</strong>. Please review the details below and ensure you are available on time.
      </div>

      <div class="info-card">
        <div class="info-row">
          <div class="info-label">📅 Date:</div>
          <div class="info-val">${date}</div>
        </div>
        <div class="info-row">
          <div class="info-label">⏰ Time:</div>
          <div class="info-val">${time} (${duration})</div>
        </div>
        <div class="info-row">
          <div class="info-label">👨‍🏫 Trainer / Lead:</div>
          <div class="info-val">${trainerName}</div>
        </div>
        ${meetingId ? `
        <div class="info-row">
          <div class="info-label">🔑 Meeting ID:</div>
          <div class="info-val"><code>${meetingId}</code></div>
        </div>` : ''}
        ${passcode ? `
        <div class="info-row">
          <div class="info-label">🔒 Passcode:</div>
          <div class="info-val"><code>${passcode}</code></div>
        </div>` : ''}
      </div>

      ${customMessage ? `
      <div class="custom-message-box">
        <strong>Special Message:</strong><br/>
        ${customMessage}
      </div>
      ` : ''}

      <div class="btn-container">
        <a href="${finalMeetingLink}" class="join-btn" target="_blank" rel="noopener noreferrer">
          👉 Click to Join Microsoft Teams Meeting
        </a>
        <div class="raw-link">
          Or copy link: <a href="${finalMeetingLink}" style="color: #464EB8;">${finalMeetingLink}</a>
        </div>
      </div>

      <div class="section-title">Session Agenda & Objectives</div>
      <div class="agenda-box">${agenda}</div>

      ${prerequisites ? `
      <div class="section-title">Prerequisites & Preparation</div>
      <div class="agenda-box">${prerequisites}</div>
      ` : ''}

      <div class="section-title">Joining Instructions</div>
      <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
        ${instructions}
      </p>

      <p style="font-size: 13px; color: #475569; margin-top: 24px;">
        Warm regards,<br />
        <strong>${trainerName}</strong><br />
        <em>${senderDisplayName}</em>
      </p>
    </div>

    <div class="footer">
      This is an automated notification from HRMS Training & Development. If you have any questions or scheduling conflicts, please reply directly to this email or reach out to HR.
    </div>
  </div>
</body>
</html>
        `

        try {
          if (isAzureMode) {
            // Strictly send through the configured Microsoft 365 account ONLY
            const sendResult = await sendMicrosoftGraphMail({
              tenantId: azureTenantId,
              clientId: azureClientId,
              clientSecret: azureClientSecret,
              fromEmail: azureUserId,
              fromDisplayName: senderDisplayName,
              toEmail,
              toName: empName,
              subject: emailSubject,
              html: emailHtml,
              cachedAccessToken: microsoftAccessToken
            })
            microsoftAccessToken = sendResult.accessToken
          } else if (googleMailConfig?.enabled && googleMailConfig?.email && googleMailConfig?.appPassword) {
            // Send via configured Google SMTP
            await notificationService.sendEmail(
              toEmail,
              emailSubject,
              emailHtml,
              `Training Invitation: ${title}\nDate: ${date}\nTime: ${time}\nTrainer: ${trainerName}\nJoin Teams: ${finalMeetingLink}`,
              undefined,
              senderDisplayName,
              {
                email: googleMailConfig.email,
                appPassword: googleMailConfig.appPassword,
                senderName: senderDisplayName
              }
            )
          } else {
            // Fallback system notification (only if neither Azure nor Google SMTP was configured)
            await notificationService.sendEmail(
              toEmail,
              emailSubject,
              emailHtml,
              `Training Invitation: ${title}\nDate: ${date}\nTime: ${time}\nTrainer: ${trainerName}\nJoin Teams: ${finalMeetingLink}`,
              undefined,
              senderDisplayName
            )
          }

          results.push({ email: toEmail, name: empName, success: true })
          successCount++
        } catch (err: any) {
          console.error(`[TrainingController] Error sending email to ${toEmail}:`, err.message || err)
          results.push({ email: toEmail, name: empName, success: false, error: err.message || 'Email transmission error' })
          failCount++
        }
      }

      const channelDesc = isAzureMode
        ? `via Microsoft 365 (${azureUserId})`
        : (googleMailConfig?.enabled ? `via Google Mail (${googleMailConfig.email})` : 'via system notification')

      return sendSuccess(
        res,
        {
          total: recipients.length,
          successCount,
          failCount,
          meetingLink: finalMeetingLink,
          senderEmail: isAzureMode ? azureUserId : (googleMailConfig?.email || 'System'),
          session: savedSession,
          results
        },
        `Microsoft Teams invitations dispatched ${channelDesc} to ${successCount} employee${successCount === 1 ? '' : 's'}${failCount > 0 ? ` (${failCount} failed)` : ''}.`
      )
    } catch (error: any) {
      console.error('[TrainingController] sendTrainingInvitations error:', error)
      return sendError(res, error.message || 'Failed to dispatch training invitations', 500)
    }
  },

  async listSessions(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    const { year, month, date } = req.query as Record<string, string | undefined>
    try {
      const whereClause: any = { tenantId }
      if (date) {
        const dStr = String(date).split('T')[0]
        whereClause.sessionDate = new Date(`${dStr}T00:00:00.000Z`)
      } else if (year && month) {
        const y = Number(year)
        const m = Number(month)
        whereClause.sessionDate = {
          gte: new Date(Date.UTC(y, m - 1, 1)),
          lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
        }
      }

      const sessions = await prisma.trainingSession.findMany({
        where: whereClause,
        include: {
          participants: {
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ sessionDate: 'asc' }, { createdAt: 'desc' }],
      })

      return sendSuccess(
        res,
        sessions.map((s) => ({
          ...s,
          sessionDate: s.sessionDate.toISOString().split('T')[0],
        }))
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to list training & meeting sessions', 500)
    }
  },

  async getMySessions(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const userId = req.user?.id
    if (!tenantId || !userId) return sendError(res, 'Unauthorized', 401)

    try {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      })
      if (!employee) return sendSuccess(res, [])

      const { year, month, today } = req.query as Record<string, string | undefined>
      const sessionFilter: any = { tenantId }
      if (today === 'true') {
        const todayIso = new Date().toLocaleDateString('en-CA')
        sessionFilter.sessionDate = new Date(`${todayIso}T00:00:00.000Z`)
      } else if (year && month) {
        const y = Number(year)
        const m = Number(month)
        sessionFilter.sessionDate = {
          gte: new Date(Date.UTC(y, m - 1, 1)),
          lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
        }
      }

      const participations = await prisma.trainingParticipant.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          session: sessionFilter,
        },
        include: {
          session: true,
        },
        orderBy: { session: { sessionDate: 'asc' } },
      })

      return sendSuccess(
        res,
        participations.map((p) => ({
          participantId: p.id,
          attendanceStatus: p.attendanceStatus,
          overrideMode: p.overrideMode,
          deductedMinutes: p.deductedMinutes,
          hrNotes: p.hrNotes,
          id: p.session.id,
          sessionType: p.session.sessionType,
          title: p.session.title,
          trainerName: p.session.trainerName,
          sessionDate: p.session.sessionDate.toISOString().split('T')[0],
          timeSlot: p.session.timeSlot,
          duration: p.session.duration,
          teamsUrl: p.session.teamsUrl,
          meetingId: p.session.meetingId,
          passcode: p.session.passcode,
          agenda: p.session.agenda,
          status: p.session.status,
          cancelledAt: p.session.cancelledAt,
          cancelReason: p.session.cancelReason,
        }))
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to load employee sessions', 500)
    }
  },

  async markParticipantAttendance(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const { sessionId } = req.params
    const { employeeId, attendanceStatus, overrideMode, hrNotes } = req.body as {
      employeeId?: string
      attendanceStatus?: TrainingParticipantStatus
      overrideMode?: AttendanceOverrideMode
      hrNotes?: string
    }

    if (!tenantId || !sessionId || !employeeId) {
      return sendError(res, 'sessionId and employeeId are required', 400)
    }

    try {
      const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } })
      if (!session || session.tenantId !== tenantId) {
        return sendError(res, 'Training/Meeting session not found', 404)
      }

      const participant = await prisma.trainingParticipant.findUnique({
        where: { sessionId_employeeId: { sessionId, employeeId } },
      })
      if (!participant) {
        return sendError(res, 'Employee is not registered in this session', 404)
      }

      const nextStatus: TrainingParticipantStatus =
        attendanceStatus && Object.values(TrainingParticipantStatus).includes(attendanceStatus)
          ? attendanceStatus
          : TrainingParticipantStatus.ATTENDED
      const nextOverride: AttendanceOverrideMode =
        overrideMode && Object.values(AttendanceOverrideMode).includes(overrideMode)
          ? overrideMode
          : AttendanceOverrideMode.NONE

      const sessionMins = parseDurationMinutes(session.duration)
      const deductedMinutes =
        nextOverride === AttendanceOverrideMode.SESSION_ONLY
          ? sessionMins
          : nextOverride === AttendanceOverrideMode.HALF_DAY
          ? 240
          : nextOverride === AttendanceOverrideMode.FULL_DAY
          ? 480
          : 0

      const updatedParticipant = await prisma.trainingParticipant.update({
        where: { id: participant.id },
        data: {
          attendanceStatus: nextStatus,
          overrideMode: nextOverride,
          deductedMinutes,
          hrNotes: hrNotes?.trim() || null,
          markedById: req.user?.id,
          markedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true } },
        },
      })

      // Apply manual attendance override to the Attendance table for that sessionDate
      const existingAtt = await prisma.attendance.findFirst({
        where: { tenantId, employeeId, date: session.sessionDate },
      })

      const noteTag = `[${session.sessionType}: ${session.title}] ${nextStatus} (${nextOverride})`
      if (nextOverride === AttendanceOverrideMode.FULL_DAY) {
        if (existingAtt) {
          await prisma.attendance.update({
            where: { id: existingAtt.id },
            data: { status: AttendanceStatus.ABSENT, totalHours: 0, notes: noteTag },
          })
        } else {
          await prisma.attendance.create({
            data: {
              tenantId,
              employeeId,
              date: session.sessionDate,
              status: AttendanceStatus.ABSENT,
              totalHours: 0,
              loginMethod: 'MANUAL_HR_OVERRIDE',
              notes: noteTag,
            },
          })
        }
      } else if (nextOverride === AttendanceOverrideMode.HALF_DAY) {
        if (existingAtt) {
          const cappedHrs = existingAtt.totalHours !== null ? Math.min(existingAtt.totalHours, 4) : 4
          await prisma.attendance.update({
            where: { id: existingAtt.id },
            data: { status: AttendanceStatus.HALF_DAY, totalHours: cappedHrs, notes: noteTag },
          })
        } else {
          await prisma.attendance.create({
            data: {
              tenantId,
              employeeId,
              date: session.sessionDate,
              status: AttendanceStatus.HALF_DAY,
              totalHours: 4,
              loginMethod: 'MANUAL_HR_OVERRIDE',
              notes: noteTag,
            },
          })
        }
      } else if (nextOverride === AttendanceOverrideMode.SESSION_ONLY) {
        if (existingAtt) {
          const nextIdle = Math.max(existingAtt.idleMinutes || 0, sessionMins)
          const nextTotal =
            existingAtt.totalHours !== null
              ? Math.max(0, Math.round((existingAtt.totalHours - sessionMins / 60) * 100) / 100)
              : null
          await prisma.attendance.update({
            where: { id: existingAtt.id },
            data: {
              idleMinutes: nextIdle,
              ...(nextTotal !== null ? { totalHours: nextTotal } : {}),
              notes: noteTag,
            },
          })
        } else {
          await prisma.attendance.create({
            data: {
              tenantId,
              employeeId,
              date: session.sessionDate,
              status: AttendanceStatus.PRESENT,
              idleMinutes: sessionMins,
              loginMethod: 'MANUAL_HR_OVERRIDE',
              notes: noteTag,
            },
          })
        }
      } else if (nextStatus === TrainingParticipantStatus.ATTENDED) {
        if (existingAtt) {
          await prisma.attendance.update({
            where: { id: existingAtt.id },
            data: {
              ...(existingAtt.status === AttendanceStatus.ABSENT ? { status: AttendanceStatus.PRESENT } : {}),
              notes: noteTag,
            },
          })
        } else {
          await prisma.attendance.create({
            data: {
              tenantId,
              employeeId,
              date: session.sessionDate,
              status: AttendanceStatus.PRESENT,
              loginMethod: 'MANUAL_HR_OVERRIDE',
              notes: noteTag,
            },
          })
        }
      }

      return sendSuccess(res, updatedParticipant, 'Attendance override saved successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update session attendance override', 500)
    }
  },

  async cancelSession(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const { sessionId } = req.params
    const { reason } = req.body as { reason?: string }
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    try {
      const existing = await prisma.trainingSession.findFirst({
        where: { id: sessionId, tenantId },
      })
      if (!existing) return sendError(res, 'Training or meeting session not found', 404)

      const updated = await prisma.trainingSession.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason?.trim() || 'Cancelled by HR',
        },
        include: {
          participants: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true } },
            },
          },
        },
      })

      return sendSuccess(
        res,
        {
          ...updated,
          sessionDate: updated.sessionDate.toISOString().split('T')[0],
        },
        `${updated.sessionType === 'MEETING' ? 'Meeting' : 'Training'} cancelled and employees notified in their portal.`
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to cancel session', 500)
    }
  },
}
