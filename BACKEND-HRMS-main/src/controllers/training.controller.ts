import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendSuccess, sendError } from '../utils/response.utils'
import { notificationService } from '../services/notification.service'
import { generateTeamsMeetingLink } from '../services/interview.service'
import nodemailer from 'nodemailer'

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
        subject: customSubject
      } = req.body

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return sendError(res, 'Please select at least one employee recipient.', 400)
      }

      const {
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
      if (!finalMeetingLink) {
        finalMeetingLink = await generateTeamsMeetingLink(title, undefined, undefined, teamsConfig)
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
          results
        },
        `Microsoft Teams training invitations dispatched ${channelDesc} to ${successCount} employee${successCount === 1 ? '' : 's'}${failCount > 0 ? ` (${failCount} failed)` : ''}.`
      )
    } catch (error: any) {
      console.error('[TrainingController] sendTrainingInvitations error:', error)
      return sendError(res, error.message || 'Failed to dispatch training invitations', 500)
    }
  }
}
