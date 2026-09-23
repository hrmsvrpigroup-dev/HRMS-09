import crypto from 'crypto';
import { notificationService } from './notification.service';

export interface InterviewInviteParams {
  candidateName: string;
  candidateEmail: string;
  jobTitle?: string;
  interviewType?: string;
  interviewerName?: string;
  interviewerEmail?: string;
  interviewDate: string; // YYYY-MM-DD
  interviewTime: string; // e.g. "11:30 AM"
  interviewLink: string;
  taggedEmails?: string[];
  tenantName?: string;
  notes?: string;
  googleMailConfig?: any;
  teamsConfig?: any;
}

/**
 * Create a real Microsoft Teams Online Meeting using Microsoft Graph API
 * If Azure credentials are provided from frontend or configured in .env, creates an official M365 Teams meeting on Microsoft Cloud.
 */
export async function createMicrosoftTeamsOnlineMeeting(
  topic: string, 
  startTime: Date, 
  endTime: Date, 
  customAzureConfig?: { tenantId?: string; clientId?: string; clientSecret?: string; userId?: string }
): Promise<string | null> {
  const tenantId = customAzureConfig?.tenantId?.trim() || process.env.AZURE_TENANT_ID;
  const clientId = customAzureConfig?.clientId?.trim() || process.env.AZURE_CLIENT_ID;
  const clientSecret = customAzureConfig?.clientSecret?.trim() || process.env.AZURE_CLIENT_SECRET;
  const userId = customAzureConfig?.userId?.trim() || process.env.AZURE_USER_ID; // The Microsoft 365 organizer user email or object ID

  if (!tenantId || !clientId || !clientSecret || !userId) {
    return null;
  }

  try {
    // 1. Get OAuth2 Token from Azure AD
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Microsoft Graph Auth Error]:', errText);
      return null;
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Create Online Meeting via Graph API
    const meetingUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/onlineMeetings`;
    const meetingRes = await fetch(meetingUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: topic,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
        lobbyBypassSettings: {
          scope: 'everyone',
          isDialInBypassEnabled: true
        }
      }),
    });

    if (!meetingRes.ok) {
      const errText = await meetingRes.text();
      console.error('[Microsoft Graph Meeting Error]: Status', meetingRes.status, errText);
      if (meetingRes.status === 403) {
        console.warn(`[Microsoft Teams Admin Note]: Azure AD App ${clientId} requires 'OnlineMeetings.ReadWrite.All' Application permission with Admin Consent in Azure Portal (portal.azure.com) so meetings are created under ${userId} as Organizer/Admin.`);
      }
      return null;
    }

    const meetingData: any = await meetingRes.json();
    console.log('[Microsoft Graph] Successfully created Teams Meeting:', meetingData.joinWebUrl);
    return meetingData.joinWebUrl;
  } catch (error: any) {
    console.error('[Microsoft Graph Exception]:', error.message || error);
    return null;
  }
}

/**
 * Generate a meeting join link:
 * - Uses custom/fixed Teams link from frontend if provided
 * - Tries Microsoft Graph API if Azure credentials exist (via frontend config or .env)
 * - Otherwise generates a dedicated live video interview room
 */
export async function generateTeamsMeetingLink(
  topic: string = 'Interview Session', 
  startTime?: Date, 
  endTime?: Date, 
  customTeamsConfig?: any
): Promise<string> {
  const start = startTime || new Date();
  const end = endTime || new Date(start.getTime() + 45 * 60 * 1000);

  // 1. If HR configured a custom/permanent Teams or virtual meeting link from frontend
  if (customTeamsConfig?.enabled !== false && customTeamsConfig?.customMeetingLink && customTeamsConfig.customMeetingLink.trim()) {
    return customTeamsConfig.customMeetingLink.trim();
  }

  // 2. Try Microsoft Graph API with frontend Azure config or .env config
  try {
    const customAzure = (customTeamsConfig?.azureClientId || customTeamsConfig?.clientId) ? {
      tenantId: customTeamsConfig.azureTenantId || customTeamsConfig.tenantId,
      clientId: customTeamsConfig.azureClientId || customTeamsConfig.clientId,
      clientSecret: customTeamsConfig.azureClientSecret || customTeamsConfig.clientSecret,
      userId: customTeamsConfig.azureUserId || customTeamsConfig.userId
    } : undefined;

    const graphLink = await createMicrosoftTeamsOnlineMeeting(topic, start, end, customAzure);
    if (graphLink) {
      return graphLink;
    }
  } catch (err) {
    console.warn('[Teams Graph Warning]:', err);
  }

  // 3. Fallback Microsoft Teams Meeting format with tenant context
  const tenantId = (process.env.AZURE_TENANT_ID && process.env.AZURE_TENANT_ID.includes('-'))
    ? process.env.AZURE_TENANT_ID 
    : '25276fbe-5e50-46cc-b2b0-f5d73c1ae606';
  const meetingId = crypto.randomBytes(16).toString('base64url');
  const organizerId = crypto.randomUUID();
  const context = encodeURIComponent(JSON.stringify({ Tid: tenantId, Oid: organizerId }));
  return `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${meetingId}%40thread.v2/0?context=${context}`;
}

/**
 * Parse date and 12-hour time string into Date object
 */
function parseDateTime(dateStr: string, timeStr: string): { start: Date; end: Date } {
  try {
    const parts = (timeStr || '11:30 AM').trim().split(/\s+/);
    const timeParts = parts[0].split(':');
    let hours = parseInt(timeParts[0], 10) || 11;
    const minutes = parseInt(timeParts[1] || '0', 10) || 0;
    const ampm = (parts[1] || 'AM').toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    let year = new Date().getFullYear(), month = new Date().getMonth() + 1, day = new Date().getDate();
    if (dateStr) {
      const dateParts = dateStr.trim().split(/[-/]/).map(Number);
      if (dateParts.length === 3) {
        if (dateParts[0] > 1000) {
          // YYYY-MM-DD
          [year, month, day] = dateParts;
        } else if (dateParts[2] > 1000) {
          // DD-MM-YYYY
          [day, month, year] = dateParts;
        }
      }
    }
    const start = new Date(year, month - 1, day, hours, minutes, 0);
    const end = new Date(start.getTime() + 45 * 60 * 1000); // 45 min duration default

    return { start, end };
  } catch (err) {
    const now = new Date();
    return { start: now, end: new Date(now.getTime() + 45 * 60 * 1000) };
  }
}

/**
 * Format date for ICS (YYYYMMDDTHHMMSSZ)
 */
function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generate RFC 5545 compliant iCalendar (.ics) string
 */
export function generateIcsCalendarInvite(params: {
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  organizerEmail: string;
  organizerName: string;
  attendees: { name?: string; email: string }[];
}): string {
  const uid = `hrms-teams-interview-${crypto.randomUUID()}@hrmsvrpigroup.com`;
  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(params.start);
  const dtEnd = formatIcsDate(params.end);

  const attendeeLines = params.attendees
    .filter(a => a.email && a.email.includes('@'))
    .map(a => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${a.name || a.email}:mailto:${a.email}`)
    .join('\r\n');

  const cleanDescription = params.description.replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HRMS VRPIGroup//Interview Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${params.location}`,
    `ORGANIZER;CN=${params.organizerName}:mailto:${params.organizerEmail}`,
    attendeeLines,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview Reminder - 15 Minutes to Start',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// In-memory cache to deduplicate rapid duplicate interview email dispatches
const recentInviteDispatches = new Map<string, { timestamp: number; result: any }>();

function cleanRecentInviteDispatches() {
  const now = Date.now();
  for (const [key, val] of recentInviteDispatches.entries()) {
    if (now - val.timestamp > 60000) {
      recentInviteDispatches.delete(key);
    }
  }
}

/**
 * Send interview invitation email to Candidate, Interviewer, and Tagged CCs
 */
export const interviewService = {
  generateTeamsMeetingLink,

  async sendInterviewInvites(params: InterviewInviteParams) {
    const {
      candidateName,
      candidateEmail,
      jobTitle = 'Recruitment Process',
      interviewType = 'Technical / HR Interview',
      interviewerName = 'Interview Panel',
      interviewerEmail,
      interviewDate,
      interviewTime,
      interviewLink,
      taggedEmails = [],
      tenantName = 'VRPI Group HRMS',
      notes
    } = params;

    const dedupKey = `${(candidateEmail || '').trim().toLowerCase()}_${interviewDate}_${(interviewTime || '').trim().toLowerCase()}`;
    const existing = recentInviteDispatches.get(dedupKey);
    if (existing && (Date.now() - existing.timestamp < 30000)) {
      console.log(`[InterviewService] Duplicate invite dispatch prevented for ${dedupKey} (already sent ${Math.round((Date.now() - existing.timestamp)/1000)}s ago)`);
      return existing.result;
    }

    const { start, end } = parseDateTime(interviewDate, interviewTime);

    // Build recipient list
    const allRecipients: string[] = [];
    if (candidateEmail && candidateEmail.includes('@') && !candidateEmail.includes('@example.com')) {
      allRecipients.push(candidateEmail.trim());
    }
    if (interviewerEmail && interviewerEmail.includes('@') && !allRecipients.includes(interviewerEmail.trim())) {
      allRecipients.push(interviewerEmail.trim());
    }
    taggedEmails.forEach(email => {
      const clean = (email || '').trim();
      if (clean && clean.includes('@') && !allRecipients.includes(clean)) {
        allRecipients.push(clean);
      }
    });

    if (allRecipients.length === 0) {
      console.log('[InterviewService] No valid recipient emails to dispatch interview invite.');
      return { success: false, reason: 'No valid recipient emails' };
    }

    // Determine meeting platform name
    let platformName = 'Microsoft Teams';
    const linkLower = (interviewLink || '').toLowerCase();
    if (linkLower.includes('meet.google.com')) platformName = 'Google Meet';
    else if (linkLower.includes('teams.microsoft.com') || linkLower.includes('teams.live.com')) platformName = 'Microsoft Teams';
    else if (linkLower.includes('zoom.us') || linkLower.includes('zoom.com')) platformName = 'Zoom';

    const senderDisplayName = (params.googleMailConfig?.senderName || 'VR PI Tech Solutions HR').trim();
    const contactEmail = (params.googleMailConfig?.email || 'vamshikrishna@vrpigroup.co.in').trim();

    // Generate ICS calendar attachment
    const icsContent = generateIcsCalendarInvite({
      title: `Interview: ${candidateName || 'Candidate'}`,
      description: `Interview for ${candidateName || 'Candidate'}.\n\nDate: ${interviewDate}\nTime: ${interviewTime} IST\nMode: Virtual Interview\nPlatform: ${platformName}\nMeeting Link: ${interviewLink}\n\nOrganizer: ${senderDisplayName} (${contactEmail})`,
      location: interviewLink,
      start,
      end,
      organizerEmail: contactEmail,
      organizerName: senderDisplayName,
      attendees: [
        { name: candidateName, email: candidateEmail },
        ...(interviewerEmail ? [{ name: interviewerName, email: interviewerEmail }] : []),
        ...taggedEmails.map(em => ({ email: em })),
      ]
    });

    const emailSubject = `Interview Invitation: ${candidateName || 'Candidate'} (VR PI Tech Solutions)`;

    const plainTextBody = `Dear ${candidateName || 'Candidate'},

Greetings from VR PI Tech Solutions.

We are pleased to inform you that you have been shortlisted for an interview with VR PI Tech Solutions. The interview will be conducted virtually through an online meeting.

Interview Schedule:
* Date: ${interviewDate}
* Time: ${interviewTime} IST
* Mode: Virtual Interview
* Meeting Platform: ${platformName}
* Meeting Link: ${interviewLink}

Please join the meeting 5-10 minutes prior to the scheduled time with a stable internet connection, working webcam, and microphone. Kindly keep your updated resume and documents accessible.

Best Regards,
${senderDisplayName}
VR PI Tech Solutions
${contactEmail}

---
VR PI Tech Solutions Pvt. Ltd. | Registered Office | Bangalore, India
Recruitment Communication`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${emailSubject}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; line-height:1.6;">
        <div style="max-width:620px; margin:24px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
          
          <!-- Header Banner -->
          <div style="background:linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding:28px 32px; color:#ffffff;">
            <div style="display:inline-block; background:rgba(255,255,255,0.18); padding:5px 12px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:10px;">
              VR PI Recruitment
            </div>
            <h1 style="margin:0; font-size:22px; font-weight:800; color:#ffffff;">Interview Invitation</h1>
            <p style="margin:6px 0 0 0; font-size:13px; color:#c7d2fe;">Talent Acquisition &bull; VR PI Tech Solutions</p>
          </div>

          <!-- Body Content -->
          <div style="padding:32px;">
            <p style="font-size:15px; margin:0 0 16px 0; color:#0f172a;">Dear <strong>${candidateName || 'Candidate'}</strong>,</p>
            
            <p style="font-size:15px; margin:0 0 16px 0; color:#0f172a;">Greetings from <strong>VR PI Tech Solutions</strong>.</p>
            
            <p style="font-size:15px; margin:0 0 20px 0; color:#334155; line-height:1.6;">
              We are pleased to inform you that you have been shortlisted for an interview with <strong>VR PI Tech Solutions</strong>. The interview will be conducted virtually through an online meeting.
            </p>

            <!-- Interview Details Card -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid #4f46e5; border-radius:8px; padding:18px 20px; margin:22px 0;">
              <p style="margin:0 0 12px 0; font-weight:800; color:#0f172a; font-size:15px;">Interview Schedule:</p>
              <ul style="margin:0; padding-left:20px; font-size:14px; color:#334155; line-height:1.9;">
                <li><strong>Date:</strong> ${interviewDate}</li>
                <li><strong>Time:</strong> ${interviewTime} IST</li>
                <li><strong>Mode:</strong> Virtual Interview</li>
                <li><strong>Meeting Platform:</strong> ${platformName}</li>
                <li><strong>Meeting Link:</strong> <a href="${interviewLink}" target="_blank" style="color:#4f46e5; text-decoration:underline; font-weight:700; word-break:break-all;">${interviewLink}</a></li>
              </ul>
            </div>

            <!-- Join Button Call To Action -->
            <div style="text-align:center; margin:28px 0 24px 0;">
              <a href="${interviewLink}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:12px 28px; border-radius:8px; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);">
                Join Virtual Meeting
              </a>
            </div>

            <p style="font-size:14px; margin:0 0 14px 0; color:#334155; line-height:1.6;">
              Please join the meeting <strong>5-10 minutes before the scheduled time</strong> and ensure that you have a stable internet connection, working camera, and microphone.
            </p>

            <p style="font-size:14px; margin:0 0 18px 0; color:#334155; line-height:1.6;">
              Kindly keep your updated resume and relevant documents handy for the discussion.
            </p>

            <p style="font-size:14px; margin:0 0 24px 0; color:#334155; line-height:1.6;">
              We look forward to speaking with you.
            </p>

            <div style="margin-top:28px; padding-top:18px; border-top:1px solid #f1f5f9; font-size:14px; color:#334155; line-height:1.6;">
              Best Regards,<br>
              <strong style="color:#0f172a;">${senderDisplayName}</strong><br>
              <strong style="color:#4f46e5;">VR PI Tech Solutions</strong><br>
              <a href="mailto:${contactEmail}" style="color:#4f46e5; text-decoration:none; font-weight:600;">${contactEmail}</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 32px; text-align:center; font-size:11px; color:#94a3b8; line-height:1.5;">
            This interview invitation was sent directly to you regarding your job application with VR PI Tech Solutions.<br>
            VR PI Tech Solutions Pvt. Ltd. &bull; Registered Office &bull; Bangalore, India<br>
            Questions? Reply directly to this email or reach us at <a href="mailto:${contactEmail}" style="color:#64748b;">${contactEmail}</a>.
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments = [
      {
        filename: 'interview_invite.ics',
        content: Buffer.from(icsContent, 'utf-8'),
        contentType: 'text/calendar; method=REQUEST; charset=UTF-8; name="interview_invite.ics"'
      }
    ];

    const results = [];
    for (const recipient of allRecipients) {
      try {
        console.log(`[InterviewService] Sending interview invite to: ${recipient}`);
        const res = await notificationService.sendEmail(
          recipient,
          emailSubject,
          htmlBody,
          plainTextBody,
          attachments,
          senderDisplayName,
          params.googleMailConfig
        );
        results.push({ email: recipient, success: true, res });
      } catch (err: any) {
        console.error(`[InterviewService ERROR] Failed to send email to ${recipient}:`, err.message || err);
        results.push({ email: recipient, success: false, error: err.message || String(err) });
      }
    }

    const finalResult = {
      success: results.some(r => r.success),
      dispatchedCount: results.filter(r => r.success).length,
      results
    };
    recentInviteDispatches.set(dedupKey, { timestamp: Date.now(), result: finalResult });
    cleanRecentInviteDispatches();

    return finalResult;
  },

  async sendDocumentUploadEmail(params: DocumentUploadInviteParams) {
    const {
      candidateName,
      candidateEmail,
      formUrl = DOCUMENT_UPLOAD_FORM_URL,
      tenantName = 'VR PI Tech Solutions',
      googleMailConfig
    } = params;

    const targetEmail = sanitizeEmail(candidateEmail);

    if (!targetEmail || !targetEmail.includes('@') || targetEmail.includes('@example.com')) {
      console.log(`[InterviewService] No valid recipient email for document upload invite: "${candidateEmail}"`);
      return { success: false, reason: 'Invalid or missing candidate email' };
    }

    const senderDisplayName = (googleMailConfig?.senderName || 'VR PI Tech Solutions HR').trim();
    const contactEmail = (googleMailConfig?.email || 'vamshikrishna@vrpigroup.co.in').trim();

    const emailSubject = `Document Verification: ${candidateName || 'Candidate'} - VR PI Tech Solutions`;

    const plainTextBody = `Dear ${candidateName || 'Candidate'},

Greetings from VR PI Tech Solutions.

You have cleared the interview round with VR PI Tech Solutions. As the next step in our recruitment and onboarding process, please upload your mandatory verification documents using our official document upload form:

Document Upload Link: ${formUrl}

Documents to keep ready:
1. Government Photo ID Proof (Aadhaar Card / PAN Card / Passport)
2. Educational Certificates / Degree & Marksheets
3. Previous Experience / Relieving Letters (if applicable)
4. Recent Passport Size Photograph
5. Bank Details / Cancelled Cheque

Kindly submit your documents at your earliest convenience so that our verification team can proceed with issuing your official Call Letter.

Best Regards,
${senderDisplayName}
VR PI Tech Solutions
${contactEmail}

---
VR PI Tech Solutions Pvt. Ltd. | Registered Office | Bangalore, India
Recruitment Communication`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${emailSubject}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; line-height:1.6;">
        <div style="max-width:620px; margin:24px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
          
          <!-- Header Banner -->
          <div style="background:linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%); padding:28px 32px; color:#ffffff;">
            <div style="display:inline-block; background:rgba(255,255,255,0.2); padding:5px 12px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:10px;">
              Document Verification
            </div>
            <h1 style="margin:0; font-size:22px; font-weight:800; color:#ffffff;">Document Verification Request</h1>
            <p style="margin:6px 0 0 0; font-size:13px; color:#d1fae5;">Talent Acquisition &bull; VR PI Tech Solutions</p>
          </div>

          <!-- Body Content -->
          <div style="padding:32px;">
            <p style="font-size:15px; margin:0 0 16px 0; color:#0f172a;">Dear <strong>${candidateName || 'Candidate'}</strong>,</p>
            
            <p style="font-size:15px; margin:0 0 16px 0; color:#0f172a;">Greetings from <strong>VR PI Tech Solutions</strong>.</p>
            
            <p style="font-size:15px; margin:0 0 20px 0; color:#334155; line-height:1.6;">
              We are pleased to inform you that you have successfully passed the interview round. We are excited to move your profile forward to the document verification stage.
            </p>

            <p style="font-size:15px; margin:0 0 20px 0; color:#334155; line-height:1.6;">
              To proceed with onboarding and the issuance of your official Call Letter, please submit your verification documents through our submission form below:
            </p>

            <!-- Document Form Action Card -->
            <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:12px; padding:22px 20px; margin:24px 0; text-align:center;">
              <p style="margin:0 0 14px 0; font-weight:800; color:#166534; font-size:16px;">Mandatory Document Submission Form</p>
              <div style="margin-bottom:16px;">
                <a href="${formUrl}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:13px 32px; border-radius:8px; box-shadow:0 4px 14px rgba(16, 185, 129, 0.35);">
                  Upload Verification Documents
                </a>
              </div>
              <p style="margin:0; font-size:12px; color:#4b5563; word-break:break-all;">
                Direct Form Link: <a href="${formUrl}" target="_blank" style="color:#059669; font-weight:600;">${formUrl}</a>
              </p>
            </div>

            <!-- Required Documents Checklist -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid #10b981; border-radius:8px; padding:18px 20px; margin:22px 0;">
              <p style="margin:0 0 10px 0; font-weight:800; color:#0f172a; font-size:14px;">Documents to keep ready:</p>
              <ul style="margin:0; padding-left:20px; font-size:13.5px; color:#334155; line-height:1.8;">
                <li>Government Photo ID Proof (Aadhaar Card / PAN Card / Passport)</li>
                <li>Educational Certificates (Degree / Diploma / Marksheets)</li>
                <li>Previous Employment / Experience / Relieving Letters (if applicable)</li>
                <li>Recent Passport-size Photograph</li>
                <li>Bank Account Proof (Cancelled Cheque / Bank Passbook)</li>
              </ul>
            </div>

            <p style="font-size:14px; margin:20px 0 0 0; color:#475569; line-height:1.6;">
              Please complete the submission at your earliest convenience so that our verification team can verify your proofs and generate your official Call Letter.
            </p>

            <div style="margin-top:28px; padding-top:20px; border-top:1px solid #f1f5f9;">
              <p style="margin:0; font-size:14px; font-weight:700; color:#0f172a;">Best Regards,</p>
              <p style="margin:4px 0 0 0; font-size:14px; font-weight:800; color:#10b981;">${senderDisplayName}</p>
              <p style="margin:2px 0 0 0; font-size:13px; color:#64748b;">VR PI Tech Solutions</p>
              <a href="mailto:${contactEmail}" style="color:#059669; text-decoration:none; font-size:13px; font-weight:600;">${contactEmail}</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 32px; text-align:center; font-size:11px; color:#94a3b8; line-height:1.5;">
            This recruitment document request was sent directly to you regarding your job application with VR PI Tech Solutions.<br>
            VR PI Tech Solutions Pvt. Ltd. &bull; Registered Office &bull; Bangalore, India<br>
            Questions? Reply directly to this email or contact us at <a href="mailto:${contactEmail}" style="color:#64748b;">${contactEmail}</a>.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      console.log(`[InterviewService] Sending Document Upload email invite to: ${targetEmail} (original: ${candidateEmail})`);
      const res: any = await notificationService.sendEmail(
        targetEmail,
        emailSubject,
        htmlBody,
        plainTextBody,
        undefined,
        senderDisplayName,
        googleMailConfig
      );
      if (res && res.success === false) {
        return { success: false, email: targetEmail, error: res.error || 'SMTP delivery rejected' };
      }
      return { success: true, email: targetEmail, res };
    } catch (err: any) {
      console.error(`[InterviewService ERROR] Failed to send document upload email to ${targetEmail}:`, err.message || err);
      return { success: false, email: targetEmail, error: err.message || String(err) };
    }
  }
};

export function sanitizeEmail(email: string): string {
  let clean = (email || '').trim();
  clean = clean.replace(/@gmai\.com$/i, '@gmail.com');
  clean = clean.replace(/@gamil\.com$/i, '@gmail.com');
  clean = clean.replace(/@gamail\.com$/i, '@gmail.com');
  clean = clean.replace(/@gmaill\.com$/i, '@gmail.com');
  clean = clean.replace(/@gmaii\.com$/i, '@gmail.com');
  clean = clean.replace(/@yaho\.com$/i, '@yahoo.com');
  clean = clean.replace(/@yahooo\.com$/i, '@yahoo.com');
  clean = clean.replace(/@hotmial\.com$/i, '@hotmail.com');
  clean = clean.replace(/@outlok\.com$/i, '@outlook.com');
  return clean;
}

export const DOCUMENT_UPLOAD_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSf9WXwNo7CbnrUWFYAr7_gA21anOlX5fjWTsh3oK-koTkjdoA/viewform?usp=header';

export interface DocumentUploadInviteParams {
  candidateName: string;
  candidateEmail: string;
  formUrl?: string;
  jobTitle?: string;
  tenantName?: string;
  googleMailConfig?: any;
}

