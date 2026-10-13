import { Response } from 'express'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendError, sendSuccess } from '../utils/response.utils'
import { hashPassword } from '../utils/password.utils'
import { EMPLOYEE_CREATION_COST } from '../services/tenant.service'

export const hrOnboardingController = {
  async onboardEmployee(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    try {
      const data = req.body

      // Basic Validation
      const missingFields: string[] = []
      if (!data.firstName || !String(data.firstName).trim()) missingFields.push('First Name')
      if (!data.lastName || !String(data.lastName).trim()) missingFields.push('Last Name')
      if (!data.workEmail || !String(data.workEmail).trim()) missingFields.push('Work Email')
      if (!data.personalEmail || !String(data.personalEmail).trim()) missingFields.push('Personal Email')
      if (!data.joiningDate || !String(data.joiningDate).trim()) missingFields.push('Joining Date')

      if (missingFields.length > 0) {
        return sendError(res, `Missing essential employee information: ${missingFields.join(', ')}`, 400)
      }

      // Validation removed for UAN and Document Gating

      // Validate tenant balance
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
      if (!tenant) return sendError(res, 'Tenant company not found.', 404)
      if (tenant.credits < EMPLOYEE_CREATION_COST) {
        return sendError(res, `Insufficient credits. Provisioning an employee account requires 🪙 ${EMPLOYEE_CREATION_COST} credits (current balance: 🪙 ${tenant.credits.toLocaleString()}).`, 400)
      }

      // Generate Auto Employee ID (e.g. EMP-1001) if not provided
      const empCount = await prisma.employee.count({ where: { tenantId } })
      const employeeCode = data.employeeCode || `EMP-${1000 + empCount + 1}`

      // Check if employeeCode already exists in this tenant
      const existingEmpCode = await prisma.employee.findUnique({
        where: { tenantId_employeeCode: { tenantId, employeeCode } },
      })
      if (existingEmpCode) {
        return sendError(res, `Employee Code "${employeeCode}" is already in use.`, 400)
      }

      // Check if user workEmail already exists in system
      const existingUser = await prisma.user.findUnique({
        where: { email: data.workEmail.trim() },
        include: { employeeProfile: true, tenant: true },
      })
      if (existingUser) {
        if (existingUser.employeeProfile) {
          return sendError(res, `An employee account with work email "${data.workEmail}" already exists in the system.`, 400)
        }
        if (existingUser.role === 'SUPER_ADMIN') {
          return sendError(res, `Super Admin account with work email "${data.workEmail}" cannot be onboarded as an employee.`, 400)
        }
        if (existingUser.role === 'ADMIN' && existingUser.tenant && existingUser.tenant.status === 'ACTIVE' && existingUser.tenantId !== tenantId) {
          return sendError(res, `An active administrator account with email "${data.workEmail}" exists in another organization.`, 400)
        }
      }

      // Password logic: send activation email implies generating random or placeholder pass 
      // which they must reset.
      const rawPassword = require('crypto').randomBytes(8).toString('hex')
      const hashedPassword = await hashPassword(rawPassword)
      const resetToken = require('crypto').randomBytes(32).toString('hex')

      // Transaction to create everything
      const result = await prisma.$transaction(async (tx) => {
        // Create or adopt User for Employee
        let user
        if (existingUser) {
          user = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              tenantId,
              email: data.workEmail.trim(),
              username: data.workEmail.trim().split('@')[0],
              password: hashedPassword,
              role: 'EMPLOYEE',
              firstName: data.firstName,
              lastName: data.lastName,
              phone: data.mobileNumber,
              isActive: true,
              passwordResetToken: resetToken,
              passwordResetExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            }
          })
          if (existingUser.tenantId && existingUser.tenantId !== tenantId && existingUser.tenant?.status === 'PENDING') {
            const pendingEmpCount = await tx.employee.count({ where: { tenantId: existingUser.tenantId } })
            if (pendingEmpCount === 0) {
              await tx.tenant.delete({ where: { id: existingUser.tenantId } }).catch(() => {})
            }
          }
        } else {
          user = await tx.user.create({
            data: {
              tenantId,
              email: data.workEmail.trim(),
              username: data.workEmail.trim().split('@')[0],
              password: hashedPassword,
              role: 'EMPLOYEE',
              firstName: data.firstName,
              lastName: data.lastName,
              phone: data.mobileNumber,
              isActive: true,
              passwordResetToken: resetToken,
              passwordResetExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            }
          })
        }

        // Create Employee
        const employee = await tx.employee.create({
          data: {
            tenantId,
            userId: user.id,
            employeeCode,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.workEmail,
            personalEmail: data.personalEmail,
            phone: data.mobileNumber,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            gender: data.gender,
            maritalStatus: data.maritalStatus,
            departmentId: data.departmentId || null,
            designationId: data.designationId || null,
            managerId: data.reportingManagerId || null,
            hrUserId: req.user?.id,
            salaryGross: parseFloat(data.basicSalary) || 0,
            joiningDate: new Date(data.joiningDate || Date.now()),
            employmentType: data.employmentType || 'FULL_TIME',
            status: data.employmentStatus || 'ACTIVE',
            branchId: data.branchId || null,
            shift: data.shift || null,
            attendanceType: data.attendanceType || 'FACIAL',
            geoFencing: data.geoFencingEnabled === 'true',
            twoFactor: data.twoFactorEnabled === 'true',
            experienceLevel: data.experienceLevel || 'fresher',
          }
        })

        // Create Payroll Details
        await tx.employeePayrollDetails.create({
          data: {
            employeeId: employee.id,
            salaryStructure: data.salaryStructure,
            basicSalary: parseFloat(data.basicSalary) || 0,
            paymentType: data.paymentType,
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            ifscCode: data.ifscCode,
            panNumber: data.panNumber,
            uanNumber: data.uanNumber,
            pfEnabled: data.pfEnabled === 'true',
            esiEnabled: data.esiEnabled === 'true',
          }
        })

        // Create Address
        await tx.employeeAddress.create({
          data: {
            employeeId: employee.id,
            country: data.country,
            state: data.state,
            city: data.city,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2,
            postalCode: data.postalCode,
          }
        })

        // Create Emergency Contact
        if (data.emergencyContactName && data.emergencyMobile) {
          await tx.employeeEmergencyContact.create({
            data: {
              employeeId: employee.id,
              name: data.emergencyContactName,
              relationship: data.emergencyRelationship || 'N/A',
              mobile: data.emergencyMobile,
            }
          })
        }

        // Put in Verification Queue
        await tx.employeeVerification.create({
          data: {
            employeeId: employee.id,
            verificationStatus: 'PENDING_REVIEW',
          }
        })

        // Debit credits
        const nextBalance = tenant.credits - EMPLOYEE_CREATION_COST
        await tx.tenant.update({
          where: { id: tenantId },
          data: { credits: nextBalance },
        })

        await tx.creditTransaction.create({
          data: {
            tenantId,
            type: 'DEBIT',
            amount: EMPLOYEE_CREATION_COST,
            description: `Onboarded employee: ${employeeCode} (${data.workEmail})`,
            balanceAfter: nextBalance,
          },
        })

        // Audit Log
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user!.id,
            action: 'EMPLOYEE_ONBOARDED',
            details: { message: `Employee ${employeeCode} (${employee.firstName} ${employee.lastName}) added to verification queue.` },
            ipAddress: req.ip || '',
          }
        })

        return { user, employee, resetToken }
      }, {
        timeout: 15000 // 15 seconds transaction timeout limit
      })

      // Handle File Uploads (Multer req.files) - Done OUTSIDE the transaction block to avoid database lock timeouts
      if (req.files && typeof req.files === 'object') {
        const fs = require('fs')
        const path = require('path')
        const dirName = `${result.employee.firstName.replace(/\s+/g, '')}${result.employee.lastName.replace(/\s+/g, '')}_${result.employee.employeeCode}`
        const employeeDir = path.join(process.cwd(), 'uploads', 'documents', dirName)
        if (!fs.existsSync(employeeDir)) {
          fs.mkdirSync(employeeDir, { recursive: true })
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] }
        const employeeDocEntries = []
        const documentEntries = []

        for (const key of Object.keys(files)) {
          const file = files[key][0]
          
          // Move file to documents directory
          const oldPath = path.join(process.cwd(), 'uploads', 'employees', file.filename)
          const newPath = path.join(employeeDir, file.filename)
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath)
          }

          const fileUrl = `/uploads/documents/${dirName}/${file.filename}`
          
          // For EmployeeDocument (onboarding review panel)
          employeeDocEntries.push({
            employeeId: result.employee.id,
            documentType: key,
            fileName: file.originalname,
            fileUrl,
          })

          // For Document (HR Document Explorer)
          documentEntries.push({
            tenantId,
            employeeId: result.employee.id,
            name: file.originalname,
            type: key,
            fileUrl,
            fileSize: file.size || null,
            verified: false,
          })
        }

        if (employeeDocEntries.length > 0) {
          await prisma.employeeDocument.createMany({ data: employeeDocEntries })
        }
        if (documentEntries.length > 0) {
          await prisma.document.createMany({ data: documentEntries })
        }
      }



      return sendSuccess(res, {
        employeeId: result.employee.id,
        employeeCode: result.employee.employeeCode,
        name: `${result.employee.firstName} ${result.employee.lastName}`,
        email: result.user.email,
      }, 'Employee created successfully and queued for verification.')
    } catch (err: any) {
      console.error('[onboardEmployee error]', err)
      if (err.code === 'P2002' || (err.message && err.message.includes('Unique constraint failed on the fields: (`email`)'))) {
        return sendError(res, `An employee account with work email "${req.body?.workEmail || ''}" already exists in the system.`, 400)
      }
      return sendError(res, err.message || 'Failed to create employee', 500)
    }
  },

  async getVerifications(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    try {
      // Find all employees in tenant (selecting essential metadata, excluding large base64 fields like photo, signature, faceBaseline)
      const employees = await prisma.employee.findMany({
        where: { tenantId },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
          personalEmail: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
          maritalStatus: true,
          employmentType: true,
          status: true,
          salaryGross: true,
          joiningDate: true,
          branchId: true,
          shift: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true,
            }
          },
          designation: {
            select: {
              id: true,
              title: true,
            }
          },
          verification: true,
          payrollDetails: true,
          addressInfo: true,
          emergencyContact: true,
          onboardingDocs: true,
        },
        orderBy: { createdAt: 'desc' }
      })

      // Count stats
      let pendingCount = 0
      let verifiedCount = 0
      let approvedCount = 0
      let rejectedCount = 0

      const mapped = employees.map(e => {
        let v: any = e.verification
        if (!v) {
          v = {
            id: `auto-${e.id}`,
            employeeId: e.id,
            verificationStatus: e.status === 'ACTIVE' ? 'APPROVED' : 'PENDING_REVIEW',
            verificationNotes: null,
            rejectionReason: null,
            verifiedById: null,
            verifiedAt: null,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          }
          ;(e as any).verification = v
        }

        if (v.verificationStatus === 'PENDING_REVIEW') pendingCount++
        else if (v.verificationStatus === 'VERIFIED') verifiedCount++
        else if (v.verificationStatus === 'APPROVED') approvedCount++
        else if (v.verificationStatus === 'REJECTED') rejectedCount++

        return e
      })

      return sendSuccess(res, {
        stats: {
          pending: pendingCount,
          verified: verifiedCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        queue: mapped
      })
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to fetch verifications', 500)
    }
  },

  async updateVerificationAction(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)
    const { id, action } = req.params
    const { notes, reason } = req.body // action: 'VERIFY', 'APPROVE', 'REJECT'

    try {
      let verif = await prisma.employeeVerification.findUnique({
        where: { employeeId: id },
        include: { employee: true }
      })

      if (!verif) {
        const emp = await prisma.employee.findUnique({ where: { id } })
        if (!emp || emp.tenantId !== tenantId) {
          return sendError(res, 'Employee verification record not found', 404)
        }
        verif = await prisma.employeeVerification.create({
          data: {
            employeeId: id,
            verificationStatus: 'PENDING_REVIEW',
          },
          include: { employee: true }
        })
      }

      if (verif.employee.tenantId !== tenantId) {
        return sendError(res, 'Verification record not found', 404)
      }

      let newStatus: any = 'PENDING_REVIEW'
      if (action === 'VERIFY') newStatus = 'VERIFIED'
      if (action === 'APPROVE') newStatus = 'APPROVED'
      if (action === 'REJECT') newStatus = 'REJECTED'

      if (verif.verificationStatus === newStatus) {
        return sendError(res, `This verification profile is already ${newStatus.toLowerCase().replace('_', ' ')}.`, 400)
      }

      const updated = await prisma.employeeVerification.update({
        where: { employeeId: id },
        data: {
          verificationStatus: newStatus,
          verificationNotes: notes || verif.verificationNotes,
          rejectionReason: reason || verif.rejectionReason,
          verifiedById: req.user?.id,
          verifiedAt: new Date(),
        }
      })

      // Send credentials email when approved
      if (newStatus === 'APPROVED' && verif.employee.userId) {
        try {
          const rawPassword = require('crypto').randomBytes(8).toString('hex')
          const hashedPassword = await hashPassword(rawPassword)

          await prisma.user.update({
            where: { id: verif.employee.userId },
            data: { password: hashedPassword }
          })

          const { notificationService } = await import('../services/notification.service')
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true, subdomain: true },
          })
          const companyName = tenant?.name || 'Your Company'
          const { onboardingService } = await import('../services/onboarding.service')
          const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined)
          const loginUrl = onboardingService.buildCompanyPortalUrl(tenant?.subdomain || undefined, origin)

          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to ${companyName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px; }
    .content { padding: 40px; }
    .greeting { font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 24px; }
    .creds-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .creds-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 18px; }
    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { font-size: 13px; color: #64748b; font-weight: 600; }
    .cred-value { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #0f172a; background: #fff; padding: 5px 12px; border-radius: 7px; border: 1px solid #e2e8f0; }
    .pass-highlight { background: #fef3c7; border: 2px solid #fcd34d; border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
    .pass-highlight .label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #92400e; margin-bottom: 8px; }
    .pass-highlight .pass { font-family: 'Courier New', monospace; font-size: 24px; font-weight: 800; color: #78350f; letter-spacing: 0.12em; }
    .warning { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #9f1239; font-weight: 600; line-height: 1.5; }
    .btn { display: block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff !important; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; text-align: center; margin: 28px 0 0; box-shadow: 0 6px 20px rgba(79,70,229,0.3); }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>🎉 Welcome to ${companyName}</h1>
        <p>Your profile has been approved</p>
      </div>
      <div class="content">
        <p class="greeting">Hello <strong>${verif.employee.firstName} ${verif.employee.lastName}</strong>,</p>
        <p class="greeting">Your employee profile has been fully verified and approved by HR. Below are your login credentials to access the HRMS portal.</p>

        <div class="creds-box">
          <div class="creds-title">Your Account Details</div>
          <div class="cred-row">
            <span class="cred-label">Employee ID</span>
            <span class="cred-value">${verif.employee.employeeCode}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Work Email (Login)</span>
            <span class="cred-value">${verif.employee.email}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Company</span>
            <span class="cred-value">${companyName}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Joining Date</span>
            <span class="cred-value">${new Date(verif.employee.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        <div class="pass-highlight">
          <div class="label">🔑 Your New Temporary Password</div>
          <div class="pass">${rawPassword}</div>
        </div>

        <div class="warning">
          ⚠️ This is a temporary password. Please change it immediately after your first login to keep your account secure.
        </div>

        <a href="${loginUrl}" class="btn" target="_blank">Login to HRMS Portal →</a>
      </div>
      <div class="footer">
        <p>Use your <strong>Work Email</strong> and the temporary password above to log in.</p>
        <p>If you did not expect this email, please contact your HR administrator immediately.</p>
        <p>&copy; 2026 ${companyName} · HRMS Enterprise</p>
      </div>
    </div>
  </div>
</body>
</html>`

          await notificationService.sendEmail(
            (verif.employee as any).personalEmail || verif.employee.email,
            `Welcome to ${companyName} — Your Profile is Approved`,
            emailHtml
          )
        } catch (emailErr) {
          console.error('[APPROVAL CREDENTIALS EMAIL ERROR]', emailErr)
        }
      }

      return sendSuccess(res, updated, `Employee verification status updated to ${newStatus}`)
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update verification status', 500)
    }
  }
}
