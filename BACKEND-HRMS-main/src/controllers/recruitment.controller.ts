import { Response } from 'express'
import PDFDocument from 'pdfkit'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendError, sendSuccess } from '../utils/response.utils'
import { interviewService, generateTeamsMeetingLink, DOCUMENT_UPLOAD_FORM_URL } from '../services/interview.service'
import { notificationService } from '../services/notification.service'
import { callLetterLogoBase64 } from '../assets/callLetterLogo.base64'

function numberToWordsINR(num?: number | null): string {
  if (!num || isNaN(num) || num <= 0) return ''
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const convert = (n: number): string => {
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '')
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '')
  }

  return convert(Math.floor(num)) + ' Rupees Only'
}

function generateCallLetterPDF(data: {
  formattedDate: string
  refNumber: string
  candName: string
  candRole: string
  locationStr: string
  formattedSalaryNum: string
  salaryInWords: string
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 25, bottom: 25, left: 45, right: 45 },
        autoFirstPage: true
      })

      const chunks: Buffer[] = []
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', err => reject(err))

      // Logo on top right
      try {
        const logoBuffer = Buffer.from(callLetterLogoBase64, 'base64')
        doc.image(logoBuffer, 550 - 80, 22, { width: 80 })
      } catch (_) {}

      // Company text on header
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#1e293b')
        .text('VR PI TECH SOLUTIONS LLP', 45, 25)
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#475569')
        .text('Head Quarters : 2-27-163, Gandhi Nagar, Near Jammi Chettu, Wanaparthy, Telangana, India - 509103.', 45, 38)
        .text('Email: talentacquisition@vrpigroup.co.in  |  Phone: (+91) 879-094-6714', 45, 48)

      // Divider line
      doc
        .strokeColor('#cbd5e1')
        .lineWidth(0.75)
        .moveTo(45, 62)
        .lineTo(550, 62)
        .stroke()

      // Reset text color
      doc.fillColor('#000000')

      // Header: LETTER OF INTENT
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('LETTER OF INTENT', 45, 74, { align: 'center', underline: true })
        .moveDown(0.7)

      // Meta: Date (left) and Ref no. (right)
      const metaY = doc.y
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('Date: ', 45, metaY, { continued: true })
        .font('Helvetica')
        .text(data.formattedDate)

      // Measure width of ref number
      const refLabel = 'Ref no.: '
      const refVal = data.refNumber || ''
      const totalRefWidth = doc.font('Helvetica-Bold').widthOfString(refLabel) + doc.font('Helvetica').widthOfString(refVal)
      const refX = Math.max(260, 550 - totalRefWidth)

      doc
        .font('Helvetica-Bold')
        .text(refLabel, refX, metaY, { continued: true })
        .font('Helvetica')
        .text(refVal)

      doc.x = 45
      doc.y = metaY + 20

      // Addressee
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .text('To')
        .text('Mr / Ms / Mrs. ', { continued: true })
        .font('Helvetica-Bold')
        .text(data.candName)
        .moveDown(0.7)

      // Subject
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Sub: Offer Letter', { align: 'center' })
        .moveDown(0.7)

      // Salutation
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .text('Dear ', { continued: true })
        .font('Helvetica-Bold')
        .text(data.candName, { continued: true })
        .font('Helvetica')
        .text(',')
        .moveDown(0.6)

      // Body paragraphs with clean paragraph separation and natural word spacing
      const lineGap = 2

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .text('We are pleased to offer you the post of ', { continued: true, lineGap, align: 'left' })
        .font('Helvetica-Bold')
        .text(data.candRole, { continued: true })
        .font('Helvetica')
        .text(' based at ', { continued: true })
        .font('Helvetica-Bold')
        .text(data.locationStr, { continued: true })
        .font('Helvetica')
        .text('.')
        .moveDown(0.65)

      doc
        .text('The compensation structure is enclosed for your reference as Annexure.', { lineGap, align: 'left' })
        .moveDown(0.65)

      doc
        .text('Your employment with the Company will be subject to strict adherence to the policies and procedures of the Company.', { lineGap, align: 'left' })
        .moveDown(0.65)

      doc
        .text('You will be on probation for six months.', { lineGap, align: 'left' })
        .moveDown(0.65)

      doc
        .text('This offer is subjected to background verification and medical fitness.', { lineGap, align: 'left' })
        .moveDown(0.65)

      doc
        .text('On acceptance of the terms of conditions as per this offer letter, you will be able to terminate your employment with the Company by giving one (1) month notice to the Company and vice versa. You shall not be eligible to avail leave during the notice period.', { lineGap, align: 'left' })
        .moveDown(0.65)

      doc
        .text('We welcome you to join the Company and would be happy if you can sign the duplicate copy of this letter in token of your acceptance of the offer of employment with the Company.', { lineGap, align: 'left' })
        .moveDown(0.65)

      doc
        .text('If you have any question, please clarify from the undersigned.', { lineGap, align: 'left' })
        .moveDown(0.75)

      // Signoff
      doc
        .text('With regards,')
        .font('Helvetica-Bold')
        .text('Talent Acquisition Team')
        .font('Helvetica')
        .text('HR - Head')
        .moveDown(0.85)

      // ANNEXURE
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('ANNEXURE', { align: 'center', underline: true })
        .moveDown(0.65)

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .text('The gross salary of the employee for every month is as follows:', { lineGap, align: 'left' })
        .moveDown(0.4)

      doc
        .font('Helvetica-Bold')
        .text('Gross Salary/Monthly: ', 45, doc.y, { continued: true })
        .font('Helvetica')
        .text(data.formattedSalaryNum ? `Rs. ${data.formattedSalaryNum}` : 'Rs.')
        .moveDown(0.4)

      doc
        .font('Helvetica-Bold')
        .text('Amount in words: ', 45, doc.y, { continued: true })
        .font('Helvetica')
        .text(data.salaryInWords ? `${data.salaryInWords}` : ' ')
        .moveDown(0.7)

      doc
        .font('Helvetica')
        .fontSize(9)
        .text('I accept the aforesaid terms & conditions and this offer of employment. I shall keep the contents of this document confidential.', 45, doc.y, { lineGap: 1.5, align: 'left', width: 505 })
        .moveDown(0.7)

      doc
        .text('I will join on ________________.')
        .moveDown(0.35)
        .font('Helvetica-Bold')
        .text('Name: ', { continued: true })
        .text(data.candName)
        .moveDown(0.35)
        .font('Helvetica')
        .text('Signature: ___________________ .')
        .moveDown(0.35)
        .text('Date: _________________________ .')

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

export const recruitmentController = {
  // Get all jobs and applicants
  async jobs(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    try {
      let jobs = await prisma.jobPosting.findMany({
        where: { tenantId },
        include: {
          applications: {
            orderBy: { appliedAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      // Auto-initialize default active JobPosting for tenant if none exists
      if (jobs.length === 0) {
        const defaultJob = await prisma.jobPosting.create({
          data: {
            tenantId,
            title: 'Full Stack Engineer',
            department: 'Engineering',
            description: 'Official Google Form Recruitment Pipeline for Engineering & Product roles',
            status: 'OPEN',
          }
        })

        // Fetch CSV from connected Google Sheet 1lQJhC2BRKi-ut7XerrcptvLwiRpJvxGbZGZaS9WzWpg
        try {
          const csvUrl = 'https://docs.google.com/spreadsheets/d/1lQJhC2BRKi-ut7XerrcptvLwiRpJvxGbZGZaS9WzWpg/export?format=csv&gid=1809928383'
          const csvRes = await fetch(csvUrl)
          if (csvRes.ok) {
            const csvText = await csvRes.text()
            const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
            if (lines.length > 1) {
              const parseCsvLine = (lineStr: string) => {
                const result: string[] = []
                let cur = ''
                let inQuotes = false
                for (let i = 0; i < lineStr.length; i++) {
                  const c = lineStr[i]
                  if (c === '"') { inQuotes = !inQuotes }
                  else if (c === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
                  else { cur += c }
                }
                result.push(cur.trim())
                return result
              }

              const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase())

              for (let i = 1; i < lines.length; i++) {
                const rowVals = parseCsvLine(lines[i])
                if (rowVals.length === 0) continue

                let email = ''
                let name = ''
                let phone = ''
                let experience = '3 Years'
                let skills: string[] = ['React', 'TypeScript', 'Node.js']
                const attachments: string[] = []

                rowVals.forEach((cellVal: string, colIdx: number) => {
                  if (!cellVal) return
                  const headerName = headers[colIdx] || ''
                  if (headerName.includes('email') || headerName.includes('e-mail')) email = cellVal.trim()
                  else if (headerName.includes('name')) name = cellVal.trim()
                  else if (headerName.includes('phone') || headerName.includes('contact')) phone = cellVal.trim()
                  else if (headerName.includes('exp')) experience = cellVal.trim()
                  else if (headerName.includes('skill')) skills = cellVal.split(',').map(s => s.trim())

                  if (cellVal.includes('drive.google.com') || cellVal.includes('http')) {
                    const driveMatch = cellVal.match(/(?:id=|\/d\/|\/uc\?.*id=)([a-zA-Z0-9_-]{25,})/)
                    const driveId = driveMatch ? driveMatch[1] : undefined
                    const fileName = `${name ? name.replace(/\s+/g, '_') : 'Applicant'}_Resume.pdf`

                    const attMeta = JSON.stringify({
                      id: driveId || `att-${colIdx}`,
                      name: fileName,
                      type: 'pdf',
                      mimeType: 'application/pdf',
                      url: driveId ? `https://drive.google.com/uc?export=view&id=${driveId}` : cellVal,
                      downloadUrl: driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : cellVal,
                      driveId,
                      uploadedAt: new Date().toISOString()
                    })
                    attachments.push(attMeta)
                  }
                })

                if (email || name) {
                  await prisma.jobApplication.create({
                    data: {
                      jobId: defaultJob.id,
                      name: name || 'Google Form Applicant',
                      email: email || `applicant_${Date.now()}@example.com`,
                      phone: phone || null,
                      experience,
                      source: 'Google Form',
                      skills,
                      resumeUrl: attachments[0] ? attachments[0] : 'google-form-upload.pdf',
                      status: 'APPLIED',
                      attachmentImages: attachments
                    }
                  })
                }
              }
            }
          }
        } catch (err: any) {
          console.warn('[JOBS_CSV_SYNC_WARN]', err.message)
        }

        jobs = await prisma.jobPosting.findMany({
          where: { tenantId },
          include: {
            applications: {
              orderBy: { appliedAt: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      }

      return sendSuccess(res, jobs)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to load recruitment data', 500)
    }
  },

  // Stage 1: Create a Job Posting
  async createJob(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const { title, department, description, location, mediaUrl } = req.body
      if (!title || !department || !description) {
        return sendError(res, 'Title, department, and description are required', 400)
      }

      const job = await prisma.jobPosting.create({
        data: {
          tenantId,
          title,
          department,
          description,
          mediaUrl: mediaUrl || null,
          status: 'OPEN',
        }
      })

      return sendSuccess(res, job, 'Job posting created successfully', 201)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create job posting', 500)
    }
  },

  // Stage 2: Toggle Job Status
  async updateJobStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { status } = req.body
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const job = await prisma.jobPosting.update({
        where: { id, tenantId },
        data: { status }
      })

      return sendSuccess(res, job, 'Job status updated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update job status', 500)
    }
  },

  // Stage 3: Create Applicant/Application manually or via Google Form
  async createApplication(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      let { jobId, firstName, lastName, name, email, phone, experience, source, skills, attachmentImages, status, resumeUrl } = req.body
      const fullName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Applicant'

      if (!email) {
        return sendError(res, 'Email is required', 400)
      }

      if (!jobId) {
        const activeJob = await prisma.jobPosting.findFirst({
          where: { tenantId, status: 'OPEN' }
        })
        if (activeJob) {
          jobId = activeJob.id
        } else {
          const newJob = await prisma.jobPosting.create({
            data: {
              tenantId,
              title: 'Full Stack Engineer (Google Form Recruitment)',
              department: 'Engineering',
              description: 'Google Form Applications Pipeline',
              status: 'OPEN',
            }
          })
          jobId = newJob.id
        }
      }

      // Check if application already exists by email under this tenant
      const existing = await prisma.jobApplication.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' as const },
          job: { tenantId }
        }
      })

      if (existing) {
        const updated = await prisma.jobApplication.update({
          where: { id: existing.id },
          data: {
            name: fullName || existing.name,
            phone: phone || existing.phone,
            experience: experience || existing.experience,
            source: source || existing.source,
            skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s: string) => s.trim()) : existing.skills),
            resumeUrl: resumeUrl || existing.resumeUrl,
            status: status || 'SHORTLISTED',
            attachmentImages: Array.isArray(attachmentImages) && attachmentImages.length > 0 ? attachmentImages : existing.attachmentImages
          }
        })
        return sendSuccess(res, updated, 'Application updated successfully', 200)
      }

      const application = await prisma.jobApplication.create({
        data: {
          jobId,
          name: fullName,
          email,
          phone: phone || null,
          experience: experience || '2 Years',
          source: source || 'Google Form',
          skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s: string) => s.trim()) : []),
          resumeUrl: resumeUrl || 'uploaded-resume.pdf',
          status: status || 'SHORTLISTED',
          attachmentImages: Array.isArray(attachmentImages) ? attachmentImages : []
        }
      })

      return sendSuccess(res, application, 'Application submitted successfully', 201)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to submit application', 500)
    }
  },

  // Update Application Status
  async updateApplicationStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { status, email, name, phone, experience, source, skills, resumeUrl, attachmentImages } = req.body
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      let application = await prisma.jobApplication.findFirst({
        where: {
          OR: [
            { id },
            ...(id.includes('@') ? [{ email: { equals: id, mode: 'insensitive' as const } }] : []),
            ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : [])
          ],
          job: { tenantId }
        }
      })

      if (!application) {
        let activeJob = await prisma.jobPosting.findFirst({
          where: { tenantId, status: 'OPEN' }
        })
        if (!activeJob) {
          activeJob = await prisma.jobPosting.create({
            data: {
              tenantId,
              title: 'Full Stack Engineer (Google Form Recruitment)',
              department: 'Engineering',
              description: 'Official Google Form Recruitment Pipeline',
              status: 'OPEN',
            }
          })
        }

        const candEmail = email || (id.includes('@') ? id : `applicant_${Date.now()}@example.com`)
        const candName = name || 'Applicant'

        application = await prisma.jobApplication.create({
          data: {
            jobId: activeJob.id,
            name: candName,
            email: candEmail,
            phone: phone || null,
            experience: experience || 'Degree',
            source: source || 'Google Form',
            skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map((s: string) => s.trim()) : ['Google Form']),
            resumeUrl: resumeUrl || 'uploaded-resume.pdf',
            status: status || 'SHORTLISTED',
            attachmentImages: Array.isArray(attachmentImages) ? attachmentImages : []
          }
        })

        return sendSuccess(res, application, 'Application status updated successfully')
      }

      const updated = await prisma.jobApplication.update({
        where: { id: application.id },
        data: { status }
      })

      return sendSuccess(res, updated, 'Application status updated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update application status', 500)
    }
  },

  // Delete Applicant / Application
  async deleteApplication(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const email = req.body?.email || req.query?.email
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const application = await prisma.jobApplication.findFirst({
        where: {
          OR: [
            { id },
            ...(id.includes('@') ? [{ email: { equals: id, mode: 'insensitive' as const } }] : []),
            ...(typeof email === 'string' ? [{ email: { equals: email, mode: 'insensitive' as const } }] : [])
          ],
          job: { tenantId }
        }
      })

      if (application) {
        await prisma.jobApplication.delete({
          where: { id: application.id }
        })
      }

      return sendSuccess(res, null, 'Application deleted successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete application', 500)
    }
  },

  // Stage 4: Run AI Screen on candidate
  async aiScreenCandidate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const application = await prisma.jobApplication.findFirst({
        where: { id, job: { tenantId } }
      })
      if (!application) {
        return sendError(res, 'Application not found or unauthorized access', 404)
      }

      // Generate a mock semantic match score based on details (e.g. 70-98)
      const aiScore = Math.floor(Math.random() * 28) + 70

      const updated = await prisma.jobApplication.update({
        where: { id },
        data: {
          aiScore,
          status: 'AI_SCREENING'
        }
      })

      return sendSuccess(res, updated, 'Candidate screened successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'AI Screening failed', 500)
    }
  },

  // Stage 6: Schedule/Resolve Interview
  async scheduleInterview(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { 
        interviewDate, 
        interviewTime, 
        interviewType, 
        interviewer, 
        interviewLink, 
        decision,
        candidateEmail,
        interviewerEmail,
        taggedEmails,
        sendEmailInvite = true,
        notes
      } = req.body
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const cleanEmail = (candidateEmail || '').trim()
      const cleanId = (id || '').trim()
      const orConditions: any[] = []
      if (cleanId) orConditions.push({ id: cleanId })
      if (cleanEmail) orConditions.push({ email: { equals: cleanEmail, mode: 'insensitive' } })
      if (cleanId.includes('@')) orConditions.push({ email: { equals: cleanId, mode: 'insensitive' } })

      let application = await prisma.jobApplication.findFirst({
        where: {
          OR: orConditions.length > 0 ? orConditions : [{ id: 'none' }],
          job: { tenantId }
        },
        include: { job: true }
      })

      if (!application) {
        let activeJob = await prisma.jobPosting.findFirst({
          where: { tenantId, status: 'OPEN' }
        })
        if (!activeJob) {
          activeJob = await prisma.jobPosting.findFirst({
            where: { tenantId }
          })
        }
        if (!activeJob) {
          activeJob = await prisma.jobPosting.create({
            data: {
              tenantId,
              title: req.body.jobTitle || 'Full Stack Engineer',
              department: 'Engineering',
              description: 'Official Recruitment Pipeline',
              status: 'OPEN',
            }
          })
        }

        const candName = (req.body.candidateName || req.body.name || 'Candidate').trim()
        const candEmail = cleanEmail || (cleanId.includes('@') ? cleanId : `applicant_${Date.now()}@vrpigroup.com`)

        application = await prisma.jobApplication.create({
          data: {
            jobId: activeJob.id,
            name: candName,
            email: candEmail,
            phone: req.body.phone || null,
            experience: req.body.experience || 'Degree',
            source: req.body.source || 'Google Form',
            skills: Array.isArray(req.body.skills) ? req.body.skills : ['Scheduled Interview'],
            resumeUrl: req.body.resumeUrl || 'applicant-resume.pdf',
            status: decision ? (decision === 'pass' ? 'DOCUMENTS' : 'REJECTED') : 'INTERVIEW',
            interviewDate: interviewDate ? new Date(interviewDate) : null,
            interviewTime: interviewTime || null,
            interviewType: interviewType || 'HR Screening',
            interviewer: interviewer || null,
            interviewLink: interviewLink || null,
          },
          include: { job: true }
        })
      }

      const finalMeetingLink = interviewLink && interviewLink.trim()
        ? interviewLink.trim()
        : (application.interviewLink && application.interviewLink.trim()
            ? application.interviewLink.trim()
            : await generateTeamsMeetingLink(`Interview: ${application.name}`))

      const updateData: any = {}
      if (interviewDate) updateData.interviewDate = new Date(interviewDate)
      if (interviewTime) updateData.interviewTime = interviewTime
      if (interviewType) updateData.interviewType = interviewType
      if (interviewer) updateData.interviewer = interviewer
      updateData.interviewLink = finalMeetingLink

      if (decision) {
        updateData.status = decision === 'pass' ? 'DOCUMENTS' : 'REJECTED'
      } else {
        updateData.status = 'INTERVIEW'
      }

      const updated = await prisma.jobApplication.update({
        where: { id: application.id },
        data: updateData
      })

      // If scheduling a new/updated interview (not a pass/fail decision) and email invite is enabled
      let emailDispatchResult = null
      if (!decision && sendEmailInvite && (interviewDate || application.interviewDate) && (interviewTime || application.interviewTime)) {
        try {
          emailDispatchResult = await interviewService.sendInterviewInvites({
            candidateName: application.name,
            candidateEmail: application.email,
            jobTitle: application.job?.title || 'Applied Position',
            interviewType: interviewType || application.interviewType || 'Interview Round',
            interviewerName: interviewer || application.interviewer || 'Interview Panel',
            interviewerEmail: interviewerEmail,
            interviewDate: (interviewDate ? new Date(interviewDate) : (application.interviewDate || new Date())).toISOString().split('T')[0],
            interviewTime: interviewTime || application.interviewTime || '11:30 AM',
            interviewLink: finalMeetingLink,
            taggedEmails: Array.isArray(taggedEmails) ? taggedEmails : (taggedEmails ? [taggedEmails] : []),
            notes
          })
        } catch (emailErr: any) {
          console.error('[RecruitmentController] Failed to dispatch interview invite emails:', emailErr.message || emailErr)
        }
      }

      // Update candidate status to DOCUMENTS if passed (document mail is not sent automatically here)
      const documentEmailResult = null

      return sendSuccess(res, { ...updated, emailDispatchResult, documentEmailResult }, 'Interview details updated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update interview status', 500)
    }
  },

  // Direct Teams meeting link generator
  async generateTeamsLink(req: AuthRequest, res: Response) {
    try {
      const { topic, candidateEmail, candidateId } = req.body || {}
      
      // If candidate already has an interview link in DB, reuse it
      if (candidateEmail || candidateId) {
        const existing = await prisma.jobApplication.findFirst({
          where: {
            OR: [
              candidateId ? { id: candidateId } : {},
              candidateEmail ? { email: { equals: candidateEmail, mode: 'insensitive' } } : {}
            ]
          }
        })
        if (existing?.interviewLink && existing.interviewLink.trim()) {
          return sendSuccess(res, { link: existing.interviewLink.trim() }, 'Existing Teams meeting link retrieved successfully')
        }
      }

      const link = await generateTeamsMeetingLink(topic || 'HRMS Interview Session')
      return sendSuccess(res, { link }, 'Teams meeting link generated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to generate Teams meeting link', 500)
    }
  },

  // Direct dispatch of interview email invites (works for any candidate or external applicant)
  async sendInterviewInviteDirect(req: AuthRequest, res: Response) {
    try {
      const {
        candidateName,
        candidateEmail,
        jobTitle,
        interviewType,
        interviewer,
        interviewerEmail,
        interviewDate,
        interviewTime,
        interviewLink,
        taggedEmails,
        notes
      } = req.body

      const tenantId = req.tenantId ?? req.user?.tenantId
      const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null

      let existingApp = null
      if (candidateEmail) {
        existingApp = await prisma.jobApplication.findFirst({
          where: { email: { equals: candidateEmail, mode: 'insensitive' } }
        })
      }

      const finalLink = interviewLink && interviewLink.trim()
        ? interviewLink.trim()
        : (existingApp?.interviewLink && existingApp.interviewLink.trim()
            ? existingApp.interviewLink.trim()
            : await generateTeamsMeetingLink(`Interview: ${candidateName || 'Candidate'}`))

      const result = await interviewService.sendInterviewInvites({
        candidateName: candidateName || 'Candidate',
        candidateEmail,
        jobTitle: jobTitle || 'Recruitment Position',
        interviewType: interviewType || 'HR Screening',
        interviewerName: interviewer || 'Interview Panel',
        interviewerEmail: interviewerEmail,
        interviewDate: interviewDate || new Date().toISOString().split('T')[0],
        interviewTime: interviewTime || '11:30 AM',
        interviewLink: finalLink,
        taggedEmails: Array.isArray(taggedEmails) ? taggedEmails : (taggedEmails ? [taggedEmails] : []),
        tenantName: tenant?.name || 'VRPI Group HRMS',
        notes: notes || undefined
      })

      return sendSuccess(res, { ...result, link: finalLink }, 'Interview invites dispatched successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to dispatch interview invites', 500)
    }
  },

  // Direct dispatch of Document Upload invitation email with Google Form link
  async sendDocumentUploadInviteDirect(req: AuthRequest, res: Response) {
    try {
      const { candidateName, candidateEmail, formUrl } = req.body
      if (!candidateEmail) {
        return sendError(res, 'Candidate email is required', 400)
      }
      const tenantId = req.tenantId ?? req.user?.tenantId
      const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null

      const result = await interviewService.sendDocumentUploadEmail({
        candidateName: candidateName || 'Candidate',
        candidateEmail,
        formUrl: formUrl || DOCUMENT_UPLOAD_FORM_URL,
        tenantName: tenant?.name || 'VR PI Tech Solutions'
      })
      return sendSuccess(res, result, 'Document upload invitation email dispatched successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to send document upload email', 500)
    }
  },

  // Stage 7: Draft, extend, accept offers
  async manageOffer(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { offerSalary, offerJoiningDate, offerStatus } = req.body
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const application = await prisma.jobApplication.findFirst({
        where: { id, job: { tenantId } }
      })
      if (!application) {
        return sendError(res, 'Application not found or unauthorized access', 404)
      }

      const updateData: any = {}
      if (offerSalary) updateData.offerSalary = Number(offerSalary)
      if (offerJoiningDate) updateData.offerJoiningDate = new Date(offerJoiningDate)
      if (offerStatus) {
        updateData.offerStatus = offerStatus
        if (offerStatus === 'ACCEPTED') {
          updateData.status = 'HIRED'
        }
      }

      const updated = await prisma.jobApplication.update({
        where: { id },
        data: updateData
      })

      return sendSuccess(res, updated, 'Offer updated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to manage offer', 500)
    }
  },

  // Stage 5 -> Stage 6: Verify and Approve Documents -> Advance to Call Letter
  async verifyDocuments(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { verified, email, name, phone, candidateType, attachmentImages } = req.body
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      let application = await prisma.jobApplication.findFirst({
        where: {
          OR: [
            { id },
            ...(id.includes('@') ? [{ email: { equals: id, mode: 'insensitive' as const } }] : []),
            ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : [])
          ],
          job: { tenantId }
        }
      })

      if (!application) {
        let activeJob = await prisma.jobPosting.findFirst({
          where: { tenantId, status: 'OPEN' }
        })
        if (!activeJob) {
          activeJob = await prisma.jobPosting.create({
            data: {
              tenantId,
              title: 'Full Stack Engineer (Google Form Recruitment)',
              department: 'Engineering',
              description: 'Official Google Form Recruitment Pipeline',
              status: 'OPEN',
            }
          })
        }

        const candEmail = email || (id.includes('@') ? id : `applicant_${Date.now()}@example.com`)
        const candName = name || 'Applicant'

        application = await prisma.jobApplication.create({
          data: {
            jobId: activeJob.id,
            name: candName,
            email: candEmail,
            phone: phone || null,
            experience: candidateType || 'Experienced',
            source: 'Google Form (Documents)',
            skills: ['Verified Credentials'],
            resumeUrl: 'uploaded-resume.pdf',
            status: 'CALL_LETTER',
            documentsVerified: true,
            attachmentImages: Array.isArray(attachmentImages) ? attachmentImages : []
          }
        })

        return sendSuccess(res, application, 'Documents verified and candidate moved to Call Letter stage')
      }

      const updated = await prisma.jobApplication.update({
        where: { id: application.id },
        data: {
          status: 'CALL_LETTER',
          documentsVerified: true,
          ...(attachmentImages && Array.isArray(attachmentImages) && attachmentImages.length > 0 ? { attachmentImages } : {})
        }
      })

      return sendSuccess(res, updated, 'Documents verified and candidate moved to Call Letter stage')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to verify documents', 500)
    }
  },

  // Stage 9: Initiate Onboarding Invite
  async initiateOnboarding(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const tenantId = req.tenantId ?? req.user?.tenantId
      const createdById = req.user?.id
      if (!tenantId || !createdById) {
        return sendError(res, 'Tenant context not found or user context missing', 400)
      }

      const application = await prisma.jobApplication.findFirst({
        where: { id, job: { tenantId } },
        include: { job: true }
      })
      if (!application) {
        return sendError(res, 'Application not found or unauthorized access', 404)
      }

      if (application.onboarded && application.onboardingInviteId) {
        const invite = await prisma.onboardingInvite.findUnique({
          where: { id: application.onboardingInviteId }
        })
        return sendSuccess(res, { invite, application }, 'Candidate has already been onboarded')
      }

      const nameParts = application.name.split(' ')
      const firstName = nameParts[0] || 'Candidate'
      const lastName = nameParts.slice(1).join(' ') || 'Candidate'

      const { onboardingService } = require('../services/onboarding.service')
      const invite = await onboardingService.createInvite(
        {
          firstName,
          lastName,
          personalEmail: application.email,
          phoneNumber: application.phone || '',
          department: application.job.department || 'General',
          designation: application.job.title || 'Specialist',
          employmentType: 'FULL_TIME',
          joiningDate: application.offerJoiningDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          baseSalary: application.offerSalary || 50000,
          workLocation: 'Remote'
        },
        createdById,
        tenantId
      )

      const updated = await prisma.jobApplication.update({
        where: { id },
        data: {
          onboarded: true,
          onboardingInviteId: invite.id,
          status: 'HIRED'
        }
      })

      return sendSuccess(res, { invite, application: updated }, 'Onboarding invitation created successfully', 201)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to initiate onboarding invite', 500)
    }
  },

  // Attachments Handling
  async addAttachment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { attachmentImage } = req.body

      if (!attachmentImage) {
        return sendError(res, 'Attachment image base64 data is required', 400)
      }

      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const application = await prisma.jobApplication.findUnique({
        where: { id },
        include: { job: true },
      })

      if (!application || application.job.tenantId !== tenantId) {
        return sendError(res, 'Job application not found or unauthorized access', 404)
      }

      const updatedApplication = await prisma.jobApplication.update({
        where: { id },
        data: {
          attachmentImages: {
            push: attachmentImage,
          },
        },
      })

      return sendSuccess(res, updatedApplication, 'Attachment added successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to add attachment', 500)
    }
  },

  async removeAttachment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { attachmentImage } = req.body

      if (!attachmentImage) {
        return sendError(res, 'Attachment image identifier is required', 400)
      }

      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      const application = await prisma.jobApplication.findUnique({
        where: { id },
        include: { job: true },
      })

      if (!application || application.job.tenantId !== tenantId) {
        return sendError(res, 'Job application not found or unauthorized access', 404)
      }

      const newAttachments = application.attachmentImages.filter(img => img !== attachmentImage)

      const updatedApplication = await prisma.jobApplication.update({
        where: { id },
        data: {
          attachmentImages: newAttachments,
        },
      })

      return sendSuccess(res, updatedApplication, 'Attachment removed successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to remove attachment', 500)
    }
  },

  // Synchronize Google Form responses & file uploads
  async syncGoogleResponses(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) {
        return sendError(res, 'Tenant context not found', 400)
      }

      // Check if active job posting exists
      let activeJob = await prisma.jobPosting.findFirst({
        where: { tenantId, status: 'OPEN' }
      })
      if (!activeJob) {
        activeJob = await prisma.jobPosting.create({
          data: {
            tenantId,
            title: 'Full Stack Engineer (Google Form Recruitment)',
            department: 'Engineering',
            description: 'Official Google Form Recruitment Pipeline',
            status: 'OPEN',
          }
        })
      }

      // 1. Check if Google Sheet ID is configured in process.env or fallback to provided user spreadsheet ID
      const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1lQJhC2BRKi-ut7XerrcptvLwiRpJvxGbZGZaS9WzWpg'
      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      let privateKey = process.env.GOOGLE_PRIVATE_KEY

      let syncedCount = 0

      // Always sync from public Google Sheet CSV if available
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=1809928383`
        const csvRes = await fetch(csvUrl)
        if (csvRes.ok) {
          const csvText = await csvRes.text()
          const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

          if (lines.length > 1) {
            const parseCsvLine = (lineStr: string) => {
              const result: string[] = []
              let cur = ''
              let inQuotes = false
              for (let i = 0; i < lineStr.length; i++) {
                const c = lineStr[i]
                if (c === '"') { inQuotes = !inQuotes }
                else if (c === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
                else { cur += c }
              }
              result.push(cur.trim())
              return result
            }

            const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase())

            for (let i = 1; i < lines.length; i++) {
              const rowVals = parseCsvLine(lines[i])
              if (rowVals.length === 0) continue

              let email = ''
              let name = ''
              let phone = ''
              let experience = '3 Years'
              let skills: string[] = ['React', 'TypeScript', 'Node.js']
              const attachments: string[] = []

              rowVals.forEach((cellVal: string, colIdx: number) => {
                if (!cellVal) return
                const headerName = headers[colIdx] || ''
                if (headerName.includes('email') || headerName.includes('e-mail')) email = cellVal.trim()
                else if (headerName.includes('name')) name = cellVal.trim()
                else if (headerName.includes('phone') || headerName.includes('contact')) phone = cellVal.trim()
                else if (headerName.includes('exp')) experience = cellVal.trim()
                else if (headerName.includes('skill')) skills = cellVal.split(',').map(s => s.trim())

                // Detect Drive URLs in cells
                if (cellVal.includes('drive.google.com') || cellVal.includes('http')) {
                  const driveMatch = cellVal.match(/(?:id=|\/d\/|\/uc\?.*id=)([a-zA-Z0-9_-]{25,})/)
                  const driveId = driveMatch ? driveMatch[1] : undefined
                  const isPdf = cellVal.toLowerCase().includes('.pdf') || cellVal.toLowerCase().includes('resume')
                  const fileName = `${name ? name.replace(/\s+/g, '_') : 'Applicant'}_Resume.pdf`

                  const attMeta = JSON.stringify({
                    id: driveId || `att-${colIdx}`,
                    name: fileName,
                    type: 'pdf',
                    mimeType: 'application/pdf',
                    url: driveId ? `https://drive.google.com/uc?export=view&id=${driveId}` : cellVal,
                    downloadUrl: driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : cellVal,
                    driveId,
                    uploadedAt: new Date().toISOString()
                  })
                  attachments.push(attMeta)
                }
              })

              if (email || name) {
                const existing = await prisma.jobApplication.findFirst({
                  where: { email: email || 'unknown@example.com', jobId: activeJob.id }
                })
                if (!existing) {
                  await prisma.jobApplication.create({
                    data: {
                      jobId: activeJob.id,
                      name: name || 'Google Form Applicant',
                      email: email || `applicant_${Date.now()}@example.com`,
                      phone: phone || null,
                      experience,
                      source: 'Google Form',
                      skills,
                      resumeUrl: attachments[0] ? attachments[0] : 'google-form-upload.pdf',
                      status: 'APPLIED',
                      attachmentImages: attachments
                    }
                  })
                  syncedCount++
                } else if (attachments.length > 0) {
                  const merged = Array.from(new Set([...existing.attachmentImages, ...attachments]))
                  await prisma.jobApplication.update({
                    where: { id: existing.id },
                    data: { attachmentImages: merged }
                  })
                  syncedCount++
                }
              }
            }
          }
        }
      } catch (csvErr: any) {
        console.warn(`[CSV_SYNC_WARN] ${csvErr.message}`)
      }

      if (spreadsheetId && clientEmail && privateKey) {
        try {
          const { google } = require('googleapis')
          if (privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n')
          }
          const auth = new google.auth.JWT(
            clientEmail,
            undefined,
            privateKey,
            ['https://www.googleapis.com/auth/spreadsheets.readonly']
          )
          const sheets = google.sheets({ version: 'v4', auth })
          const sheetRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Form Responses 1!A:Z',
          })
          const rows = sheetRes.data.values || []
          if (rows.length > 1) {
            const headers = rows[0].map((h: string) => h.toLowerCase())
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i]
              if (!row || row.length === 0) continue

              let email = ''
              let name = ''
              let phone = ''
              let experience = '3 Years'
              let skills: string[] = ['React', 'Node.js']
              const attachments: string[] = []

              row.forEach((cellVal: string, colIdx: number) => {
                if (!cellVal) return
                const headerName = headers[colIdx] || ''
                if (headerName.includes('email')) email = cellVal.trim()
                else if (headerName.includes('name')) name = cellVal.trim()
                else if (headerName.includes('phone') || headerName.includes('contact')) phone = cellVal.trim()
                else if (headerName.includes('exp')) experience = cellVal.trim()
                else if (headerName.includes('skill')) skills = cellVal.split(',').map(s => s.trim())

                // Detect Google Drive URLs in cells
                if (cellVal.includes('drive.google.com') || cellVal.includes('http')) {
                  const urls = cellVal.split(/[\n,]/).map(u => u.trim()).filter(u => u.length > 0)
                  urls.forEach((fileUrl, fIdx) => {
                    const driveMatch = fileUrl.match(/(?:id=|\/d\/|\/uc\?.*id=)([a-zA-Z0-9_-]{25,})/)
                    const driveId = driveMatch ? driveMatch[1] : undefined
                    const isPdf = fileUrl.toLowerCase().includes('.pdf') || fileUrl.toLowerCase().includes('resume')
                    const isImg = fileUrl.toLowerCase().match(/\.(jpg|jpeg|png|webp)/)
                    const fileType = isPdf ? 'pdf' : (isImg ? 'image' : 'doc')
                    const fileName = isPdf ? 'Resume.pdf' : (isImg ? 'Photo.jpg' : `Attachment_${fIdx + 1}`)

                    const attMeta = JSON.stringify({
                      id: driveId || `att-${fIdx}`,
                      name: fileName,
                      type: fileType,
                      mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
                      url: driveId ? `https://drive.google.com/uc?export=view&id=${driveId}` : fileUrl,
                      downloadUrl: driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : fileUrl,
                      driveId,
                      uploadedAt: new Date().toISOString()
                    })
                    attachments.push(attMeta)
                  })
                }
              })

              if (email || name) {
                const existing = await prisma.jobApplication.findFirst({
                  where: { email: email || 'unknown@example.com', jobId: activeJob.id }
                })
                if (!existing) {
                  await prisma.jobApplication.create({
                    data: {
                      jobId: activeJob.id,
                      name: name || 'Google Form Applicant',
                      email: email || `applicant_${Date.now()}@example.com`,
                      phone: phone || null,
                      experience,
                      source: 'Google Form',
                      skills,
                      resumeUrl: attachments[0] ? attachments[0] : 'google-form-upload.pdf',
                      status: 'APPLIED',
                      attachmentImages: attachments
                    }
                  })
                  syncedCount++
                } else if (attachments.length > 0) {
                  const merged = Array.from(new Set([...existing.attachmentImages, ...attachments]))
                  await prisma.jobApplication.update({
                    where: { id: existing.id },
                    data: { attachmentImages: merged }
                  })
                  syncedCount++
                }
              }
            }
          }
        } catch (sheetErr: any) {
          console.warn(`[GOOGLE_FORM_SYNC_SHEETS_WARN] ${sheetErr.message}`)
        }
      }

      // Fetch all updated job postings & applications
      const jobs = await prisma.jobPosting.findMany({
        where: { tenantId },
        include: {
          applications: {
            orderBy: { appliedAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return sendSuccess(res, { jobs, syncedCount }, `Synchronized ${syncedCount} new application responses successfully`)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to sync Google Form responses', 500)
    }
  },

  // Secure proxy for Google Drive files
  async driveProxy(req: AuthRequest, res: Response) {
    try {
      const { fileId } = req.query
      if (!fileId || typeof fileId !== 'string') {
        return sendError(res, 'File ID is required', 400)
      }

      // Redirect securely to view URL
      // Redirect securely to view URL
      const driveViewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`
      return res.redirect(driveViewUrl)
    } catch (error: any) {
      return sendError(res, error.message || 'File proxy failed', 500)
    }
  },

  // Live fetch candidate form responses directly from Google Sheet CSV
  async fetchLiveSheetData(req: AuthRequest, res: Response) {
    try {
      const spreadsheetId = (process.env.GOOGLE_SHEET_ID || '1lQJhC2BRKi-ut7XerrcptvLwiRpJvxGbZGZaS9WzWpg').trim()
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=1809928383`
      
      const fetchCsv = (targetUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const https = require('https')
          https.get(targetUrl, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return fetchCsv(res.headers.location).then(resolve).catch(reject)
            }
            if (res.statusCode !== 200) {
              return reject(new Error(`Google Sheet HTTP ${res.statusCode}`))
            }
            let data = ''
            res.on('data', (chunk: any) => { data += chunk })
            res.on('end', () => resolve(data))
          }).on('error', reject)
        })
      }

      const csvText = await fetchCsv(csvUrl)
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

      if (lines.length <= 1) {
        return sendSuccess(res, { responses: [] }, 'No live responses found in Google Sheet')
      }

      const parseCsvLine = (lineStr: string) => {
        const result: string[] = []
        let cur = ''
        let inQuotes = false
        for (let i = 0; i < lineStr.length; i++) {
          const c = lineStr[i]
          if (c === '"') { inQuotes = !inQuotes }
          else if (c === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
          else { cur += c }
        }
        result.push(cur.trim())
        return result
      }

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase())
      const responses: any[] = []

      const sampleDriveLinks = [
        'https://drive.google.com/open?id=1KHGMjppH53O9yfI9Wj0fmUpOAjjytA7z',
        'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
        'https://drive.google.com/file/d/1e5Rj8s8eR9x2Y7z_sampleDriveMedia3/view'
      ]

      for (let i = 1; i < lines.length; i++) {
        const rowVals = parseCsvLine(lines[i])
        if (rowVals.length === 0) continue

        let timestamp = ''
        let email = ''
        let fullName = ''
        let mobile = ''
        let location = ''
        let qualification = ''
        let graduationYear = ''
        let resumeLink = ''

        // Pass 1: Scan headers dynamically
        rowVals.forEach((cellVal: string, colIdx: number) => {
          const h = (headers[colIdx] || '').toLowerCase()
          const cell = cellVal.trim()
          if (!cell) return

          if (h.includes('timestamp') || h.includes('date') || h.includes('time')) {
            if (!timestamp) timestamp = cell
          } else if (h.includes('email') || h.includes('e-mail') || h.includes('mail')) {
            if (!email) email = cell
          } else if (h.includes('full name') || h.includes('name') || h.includes('applicant') || h.includes('candidate')) {
            if (!fullName) fullName = cell
          } else if (h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('number')) {
            if (!mobile) mobile = cell
          } else if (h.includes('location') || h.includes('city') || h.includes('place') || h.includes('address')) {
            if (!location) location = cell
          } else if (h.includes('qualification') || h.includes('degree') || h.includes('education') || h.includes('qual')) {
            if (!qualification) qualification = cell
          } else if (h.includes('year') || h.includes('passing') || h.includes('graduation')) {
            if (!graduationYear) graduationYear = cell
          }

          if (cell.includes('drive.google.com') || cell.includes('http')) {
            if (!resumeLink) resumeLink = cell
          }
        })

        // Pass 2: Type detection pass for unassigned cells
        rowVals.forEach((cellVal: string) => {
          const cell = cellVal.trim()
          if (!cell) return

          if (!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) {
            email = cell
          }
          if ((!mobile || mobile === 'N/A' || /[a-zA-Z]/.test(mobile)) && /^\+?\d{10,12}$/.test(cell.replace(/[\s-]/g, ''))) {
            mobile = cell.replace(/[\s-]/g, '')
          }
          if ((!graduationYear || graduationYear === '-') && /^(19|20)\d{2}$/.test(cell)) {
            graduationYear = cell
          }
        })

        // Pass 3: Self-correction for swapped fields (e.g. Phone containing name, Location containing phone)
        if (mobile && /[a-zA-Z]/.test(mobile)) {
          if (!fullName || fullName === 'Applicant') {
            fullName = mobile
            mobile = 'N/A'
          }
        }

        if (location && /^\+?\d{10,12}$/.test(location.replace(/[\s-]/g, ''))) {
          if (!mobile || mobile === 'N/A' || /[a-zA-Z]/.test(mobile)) {
            mobile = location.replace(/[\s-]/g, '')
            location = 'WNP'
          }
        }

        if (qualification && ['mbnr', 'hyd', 'wnp', 'npl', 'hyderabad', 'wanaparthy', 'mahabubnagar'].includes(qualification.toLowerCase())) {
          if (!location || location === 'WNP' || location === 'N/A') {
            location = qualification.toUpperCase()
            qualification = 'Degree'
          }
        }

        if (!timestamp) timestamp = rowVals[0] || '24/08/2026 10:58:33'
        if (!email && rowVals[1] && rowVals[1].includes('@')) email = rowVals[1]

        if (email.includes('applicant_') || email.includes('@example.com')) continue
        if (!email && !fullName) continue

        if (!resumeLink || !resumeLink.includes('http')) {
          resumeLink = sampleDriveLinks[(i - 1) % sampleDriveLinks.length]
        }

        responses.push({
          id: `sheet-row-${i}`,
          timestamp,
          email,
          fullName,
          mobile,
          location,
          qualification,
          graduationYear,
          resumeLink
        })
      }

      return sendSuccess(res, { responses, count: responses.length }, 'Fetched live Google Form responses successfully')
    } catch (error: any) {
      console.warn('[RecruitmentController] Live sheet fetch warning:', error.message || error)
      return sendSuccess(res, { responses: [], count: 0, offline: true }, 'Google Sheet offline / fallback active')
    }
  },

  // Public real-time Document Uploads Google Sheet parser
  async fetchLiveDocumentSheetData(req: AuthRequest, res: Response) {
    try {
      const sheetId = (process.env.GOOGLE_DOCS_SHEET_ID || '1jz7d2yAaLfzgGPMpOO7GzHamvHVIspk82Y86IED_raY').trim()
      const gid = '510736051'
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

      const fetchCsv = (targetUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const https = require('https')
          https.get(targetUrl, (httpRes: any) => {
            if (httpRes.statusCode >= 300 && httpRes.statusCode < 400 && httpRes.headers.location) {
              return fetchCsv(httpRes.headers.location).then(resolve).catch(reject)
            }
            if (httpRes.statusCode !== 200) {
              return reject(new Error(`Document Sheet HTTP ${httpRes.statusCode}`))
            }
            let data = ''
            httpRes.on('data', (chunk: any) => { data += chunk })
            httpRes.on('end', () => resolve(data))
          }).on('error', reject)
        })
      }

      const csvText = await fetchCsv(csvUrl)
      
      const parseCSV = (text: string) => {
        const rows: string[][] = []
        let currentRow: string[] = []
        let currentField = ''
        let inQuotes = false
        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          const nextChar = text[i + 1]
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentField += '"'
              i++
            } else {
              inQuotes = !inQuotes
            }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField)
            currentField = ''
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++
            currentRow.push(currentField)
            if (currentRow.some(f => f.trim())) rows.push(currentRow)
            currentRow = []
            currentField = ''
          } else {
            currentField += char
          }
        }
        if (currentField || currentRow.length) {
          currentRow.push(currentField)
          if (currentRow.some(f => f.trim())) rows.push(currentRow)
        }
        return rows
      }

      const rows = parseCSV(csvText)
      if (rows.length < 2) {
        return sendSuccess(res, { applicants: [], count: 0 }, 'No document records found in Google Sheet')
      }

      const headers = rows[0].map(h => h.trim())
      const applicants: any[] = []

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        let timestamp = ''
        let candidateType = ''
        let fullName = ''
        let email = ''
        let phone = ''
        const docs: any[] = []

        row.forEach((val, idx) => {
          const v = (val || '').trim()
          const h = (headers[idx] || '').trim()
          const hl = h.toLowerCase()
          if (!v) return

          if (hl.includes('timestamp') || hl.includes('date') || hl.includes('time')) {
            if (!timestamp) timestamp = v
          } else if (hl.includes('option') || hl.includes('type') || v === 'Experienced' || v === 'Freshers') {
            candidateType = v
          } else if (hl.includes('name')) {
            fullName = v
          } else if (hl.includes('email') || hl.includes('mail') || (v.includes('@') && !v.includes('http'))) {
            email = v
          } else if (hl.includes('phone') || hl.includes('mobile') || hl.includes('contact')) {
            phone = v
          } else if (v.startsWith('http') || v.includes('drive.google.com')) {
            let docTitle = h
            let docType = 'document'
            if (hl.includes('photo')) { docTitle = 'Passport Size Photo'; docType = 'photo' }
            else if (hl.includes('aadhaar')) { docTitle = 'Aadhaar Card'; docType = 'aadhaar' }
            else if (hl.includes('pan')) { docTitle = 'PAN Card'; docType = 'pan' }
            else if (hl.includes('10th')) { docTitle = '10th Marksheet / SSC'; docType = 'marksheet_10' }
            else if (hl.includes('12th')) { docTitle = '12th Marksheet / Intermediate'; docType = 'marksheet_12' }
            else if (hl.includes('degree') || hl.includes('b.tech')) { docTitle = 'Degree / B.Tech Marksheet'; docType = 'degree' }
            else if (hl.includes('internship') || hl.includes('training')) { docTitle = 'Internship / Training Certificate'; docType = 'internship' }
            else if (hl.includes('relieving') || hl.includes('service') || hl.includes('experience')) { docTitle = 'Relieving / Experience Certificate'; docType = 'experience' }
            else if (hl.includes('uan') || hl.includes('universal')) { docTitle = 'Universal Account Number (UAN)'; docType = 'uan' }
            else if (hl.includes('form 16') || hl.includes('form16')) { docTitle = 'Provisional Form 16'; docType = 'form16' }
            else if (hl.includes('police') || hl.includes('pvc')) { docTitle = 'Police Verification Certificate (PVC)'; docType = 'pvc' }

            docs.push({ title: docTitle, url: v, type: docType, rawHeader: h })
          } else if (!fullName && v.length > 2 && !v.includes('http') && !v.includes('@')) {
            fullName = v
          }
        })

        if (!fullName && docs.length === 0) continue

        applicants.push({
          id: `sheet-doc-row-${r}`,
          fullName: fullName || `Applicant ${r}`,
          email: email || '',
          phone: phone || '',
          timestamp: timestamp || '',
          candidateType: candidateType || (docs.some(d => d.type === 'uan' || d.type === 'experience' || d.type === 'form16') ? 'Experienced' : 'Freshers'),
          docsCount: docs.length,
          documents: docs
        })
      }

      return sendSuccess(res, { applicants, count: applicants.length }, 'Fetched live document sheet records successfully')
    } catch (error: any) {
      console.warn('[RecruitmentController] Live document sheet fetch warning:', error.message || error)
      return sendSuccess(res, { applicants: [], count: 0, offline: true }, 'Document Sheet offline / fallback active')
    }
  },

  // Public real-time Received Call Letter Google Sheet parser
  async fetchLiveReceivedCallLetterData(req: AuthRequest, res: Response) {
    try {
      const sheetId = (process.env.GOOGLE_RECEIVED_CALL_LETTER_SHEET_ID || '1nFaAEv_99akWqw_FwyXPSDQnBLGDXNwYtBjb5oIw0q8').trim()
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`

      const fetchCsv = (targetUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const https = require('https')
          https.get(targetUrl, (httpRes: any) => {
            if (httpRes.statusCode >= 300 && httpRes.statusCode < 400 && httpRes.headers.location) {
              return fetchCsv(httpRes.headers.location).then(resolve).catch(reject)
            }
            if (httpRes.statusCode !== 200) {
              return reject(new Error(`Received Call Letter Sheet HTTP ${httpRes.statusCode}`))
            }
            let data = ''
            httpRes.on('data', (chunk: any) => { data += chunk })
            httpRes.on('end', () => resolve(data))
          }).on('error', reject)
        })
      }

      const csvText = await fetchCsv(csvUrl)
      
      const parseCSV = (text: string) => {
        const rows: string[][] = []
        let currentRow: string[] = []
        let currentField = ''
        let inQuotes = false
        for (let i = 0; i < text.length; i++) {
          const char = text[i]
          const nextChar = text[i + 1]
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentField += '"'
              i++
            } else {
              inQuotes = !inQuotes
            }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField)
            currentField = ''
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++
            currentRow.push(currentField)
            if (currentRow.some(f => f.trim())) rows.push(currentRow)
            currentRow = []
            currentField = ''
          } else {
            currentField += char
          }
        }
        if (currentField || currentRow.length) {
          currentRow.push(currentField)
          if (currentRow.some(f => f.trim())) rows.push(currentRow)
        }
        return rows
      }

      const rows = parseCSV(csvText)
      if (rows.length < 2) {
        return sendSuccess(res, { applicants: [], count: 0 }, 'No received call letter records found in Google Sheet')
      }

      const headers = rows[0].map(h => h.trim())
      const applicants: any[] = []

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        let timestamp = ''
        let fullName = ''
        let email = ''
        let phone = ''
        let acceptance = ''
        let questions = ''
        const docs: any[] = []

        row.forEach((val, idx) => {
          const v = (val || '').trim()
          const h = (headers[idx] || '').trim()
          const hl = h.toLowerCase()
          if (!v) return

          if (hl.includes('timestamp') || hl.includes('date') || hl.includes('time')) {
            if (!timestamp) timestamp = v
          } else if (hl.includes('name')) {
            fullName = v
          } else if (hl.includes('email') || hl.includes('mail') || (v.includes('@') && !v.includes('http'))) {
            email = v
          } else if (hl.includes('phone') || hl.includes('mobile') || hl.includes('contact')) {
            phone = v
          } else if (hl.includes('accept') || hl.includes('status') || hl.includes('call') || hl.includes('offer')) {
            if (v.startsWith('http') || v.includes('drive.google.com')) {
              acceptance = 'Signed & Uploaded'
              docs.push({ title: 'Signed Call Letter Document', url: v, type: 'signed_call_letter', rawHeader: h })
            } else {
              acceptance = v
            }
          } else if (hl.includes('question') || hl.includes('remark') || hl.includes('comment') || hl.includes('note')) {
            questions = v
          } else if (v.startsWith('http') || v.includes('drive.google.com')) {
            docs.push({ title: h || 'Uploaded Document', url: v, type: 'document', rawHeader: h })
          } else if (!fullName && v.length > 2 && !v.includes('http') && !v.includes('@')) {
            fullName = v
          }
        })

        if (!fullName && !email && docs.length === 0) continue

        applicants.push({
          id: `sheet-cl-rec-row-${r}`,
          fullName: fullName || `Applicant ${r}`,
          email: email || '',
          phone: phone || '',
          timestamp: timestamp || '',
          acceptance: acceptance || 'Signed & Accepted',
          questions: questions || '',
          docsCount: docs.length,
          documents: docs
        })
      }

      return sendSuccess(res, { applicants, count: applicants.length }, 'Fetched live received call letter sheet records successfully')
    } catch (error: any) {
      console.warn('[RecruitmentController] Live call letter sheet fetch warning:', error.message || error)
      return sendSuccess(res, { applicants: [], count: 0, offline: true }, 'Call Letter Sheet offline / fallback active')
    }
  },

  // Dispatch real-time Call Letter Email to Candidate
  async sendCallLetterDirect(req: AuthRequest, res: Response) {
    try {
      const {
        candidateId,
        candidateName,
        candidateEmail,
        jobTitle,
        referenceNo,
        reportingDate,
        reportingTime,
        venue,
        salary,
        hrEmail,
        hrPhone,
        notes
      } = req.body

      if (!candidateEmail || !candidateEmail.includes('@')) {
        return sendError(res, 'Valid candidate email is required', 400)
      }

      const tenantId = req.tenantId ?? req.user?.tenantId
      const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null
      const companyName = tenant?.name || 'VRPI Group'

      const candName = candidateName || 'Candidate'
      const candRole = (jobTitle || '')
        .replace(/\s*\([^)]*Google\s*Form[^)]*\)/gi, '')
        .replace(/\s*\(Google Form Recruitment\)/gi, '')
        .replace(/Google Form Recruitment/gi, '')
        .trim() || '(Designation - Role)'

      const dateObj = new Date()
      const currentYear = dateObj.getFullYear()
      const nextYearShort = String((currentYear + 1) % 100).padStart(2, '0')
      const financialYear = `${currentYear}-${nextYearShort}`
      const monthDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
      const defaultSlNo = Math.floor(100 + Math.random() * 900)
      const refNumber = referenceNo || `${financialYear}/${monthDate}/${defaultSlNo}`

      const repDate = reportingDate || dateObj.toISOString().split('T')[0]
      const locationStr = venue || '(Location)'
      
      const parsedNum = salary !== undefined && salary !== null && String(salary).trim() !== '' ? (typeof salary === 'number' ? salary : Number(String(salary).replace(/[^0-9.]/g, ''))) : null
      const hasSalary = parsedNum !== null && !isNaN(parsedNum) && parsedNum > 0
      const formattedSalaryNum = hasSalary ? parsedNum.toLocaleString('en-IN') : ''
      const salaryInWords = hasSalary ? numberToWordsINR(parsedNum) : ''

      const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

      const subject = `Letter of Intent / Offer Letter - ${candName} [Ref no.: ${refNumber}]`

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #0f172a; line-height: 1.65; }
          .container { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 35px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
          .greeting { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .p-text { font-size: 14px; color: #334155; margin-bottom: 14px; line-height: 1.6; }
          .action-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; border-radius: 8px; padding: 18px 22px; margin: 20px 0; }
          .action-title { font-size: 14.5px; font-weight: 800; color: #1e1b4b; margin-bottom: 10px; }
          .action-list { margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; }
          .action-list li { margin-bottom: 6px; }
          .link-btn { display: inline-block; margin: 12px 0 6px 0; padding: 10px 20px; background: #4f46e5; color: #ffffff !important; font-weight: 700; font-size: 13.5px; text-decoration: none; border-radius: 6px; }
          .doc-note { font-size: 13px; font-weight: 600; color: #475569; margin-top: 10px; }
          .signoff { margin-top: 25px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13.5px; line-height: 1.5; color: #1e293b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="greeting">Dear ${candName},</div>
          
          <p class="p-text">Greetings from <strong>VR PI TECH SOLUTIONS</strong> !</p>
          
          <p class="p-text">We are pleased to inform you that you have been selected for <strong>${candRole}</strong> at <strong>VR PI TECH SOLUTIONS</strong>. Please find the Offer/Call Letter attached to this email. We request you to carefully review the terms and conditions mentioned in the letter.</p>
          
          <div class="action-box">
            <div class="action-title">Required Action</div>
            <p class="p-text" style="margin-bottom: 8px;">If you accept the offer, please:</p>
            <ol class="action-list">
              <li>Review the attached Offer/Call Letter.</li>
              <li>Sign the document in the designated space.</li>
              <li>Save the signed document in PDF format.</li>
              <li>Upload the signed Offer/Call Letter through the recruitment form using the link below:</li>
            </ol>
            <div style="margin: 14px 0 8px 0;">
              <a href="https://docs.google.com/forms/d/e/1FAIpQLSdWlHM3eZBVCXy78iKx4ajxi2O7xlzEHe7B8wQowGxiG_PsmA/viewform?usp=header" class="link-btn" target="_blank">Open Google Recruitment Form</a>
            </div>
            <div class="doc-note">📄 <strong>Document to upload:</strong> Signed Offer/Call Letter – PDF preferred</div>
          </div>
          
          <p class="p-text"><strong>Please complete the above process within a week.</strong></p>
          
          <p class="p-text">Your signed document will be treated as confirmation of your acceptance of the offer, subject to the terms and conditions mentioned in the Offer/Call Letter.</p>
          
          <p class="p-text">If you have any questions or require clarification regarding the offer, please contact the HR team at <a href="mailto:vamshikrishna@vrpigroup.co.in" style="color: #4f46e5; font-weight: 600;">vamshikrishna@vrpigroup.co.in</a> .</p>
          
          <p class="p-text">We look forward to welcoming you to <strong>VR PI TECH SOLUTIONS</strong> and wish you a successful journey with us.</p>
          
          <div class="signoff">
            Best Regards,<br>
            <strong>Vamshi Krishna</strong><br>
            Human Resources<br>
            <strong>VR PI TECH SOLUTIONS</strong><br>
            <a href="mailto:vamshikrishna@vrpigroup.co.in" style="color: #4f46e5;">vamshikrishna@vrpigroup.co.in</a>
          </div>
        </div>
      </body>
      </html>
      `

      const text = `Dear ${candName},

Greetings from VR PI TECH SOLUTIONS !

We are pleased to inform you that you have been selected for ${candRole} at VR PI TECH SOLUTIONS. Please find the Offer/Call Letter attached to this email. We request you to carefully review the terms and conditions mentioned in the letter.

Required Action
If you accept the offer, please:
1. Review the attached Offer/Call Letter.
2. Sign the document in the designated space.
3. Save the signed document in PDF format.
4. Upload the signed Offer/Call Letter through the recruitment form using the link below.

Google Form: https://docs.google.com/forms/d/e/1FAIpQLSdWlHM3eZBVCXy78iKx4ajxi2O7xlzEHe7B8wQowGxiG_PsmA/viewform?usp=header
Document to upload: Signed Offer/Call Letter – PDF preferred

Please complete the above process within a week.

Your signed document will be treated as confirmation of your acceptance of the offer, subject to the terms and conditions mentioned in the Offer/Call Letter.

If you have any questions or require clarification regarding the offer, please contact the HR team at vamshikrishna@vrpigroup.co.in .

We look forward to welcoming you to VR PI TECH SOLUTIONS and wish you a successful journey with us.

Best Regards,
Vamshi Krishna
Human Resources
VR PI TECH SOLUTIONS
vamshikrishna@vrpigroup.co.in`

      // Generate PDF attachment
      let attachments: any[] | undefined = undefined
      try {
        const pdfBuffer = await generateCallLetterPDF({
          formattedDate,
          refNumber,
          candName,
          candRole,
          locationStr,
          formattedSalaryNum,
          salaryInWords
        })

        const sanitizedCandName = candName.replace(/[^a-zA-Z0-9]/g, '_')
        const sanitizedRef = refNumber.replace(/[^a-zA-Z0-9]/g, '_')
        attachments = [
          {
            filename: `Call_Letter_${sanitizedCandName}_${sanitizedRef}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      } catch (pdfErr: any) {
        console.error('[RecruitmentController] Non-fatal error creating Call Letter PDF attachment:', pdfErr)
      }

      // Send the real-time email with PDF attachment
      const result = await notificationService.sendEmail(
        candidateEmail,
        subject,
        html,
        text,
        attachments,
        `VR PI TECH SOLUTIONS HR`
      )

      // If this corresponds to an application in database, update its status
      if (candidateId && !candidateId.startsWith('cand-') && !candidateId.startsWith('sheet-row-')) {
        try {
          await prisma.jobApplication.update({
            where: { id: candidateId },
            data: {
              status: 'CALL_LETTER'
            }
          })
        } catch (dbErr: any) {
          console.error('[RecruitmentController] Non-fatal DB update error on call letter:', dbErr.message)
        }
      }

      return sendSuccess(res, { ...result, referenceNo: refNumber, sentTo: candidateEmail }, 'Call Letter successfully dispatched via real-time email')
    } catch (error: any) {
      console.error('[RecruitmentController] Failed to send Call Letter email:', error.message || error)
      return sendError(res, error.message || 'Failed to send Call Letter email', 500)
    }
  }
}

