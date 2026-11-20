import { Request, Response } from 'express'
import { tenantService } from '../services/tenant.service'
import { sendSuccess, sendError } from '../utils/response.utils'
import { TenantStatus, UserRole } from '@prisma/client'
import { prisma } from '../config/database'
import { comparePassword } from '../utils/password.utils'
import { notificationService } from '../services/notification.service'

export const superAdminController = {
  async dashboard(_req: Request, res: Response) {
    try {
      const tenants = await tenantService.listTenants()
      
      // Calculate total credits from actual purchases only
      const purchaseTransactions = await prisma.creditTransaction.findMany({
        where: {
          type: 'CREDIT',
          description: {
            startsWith: 'Purchased'
          }
        }
      })
      const totalCredits = purchaseTransactions.reduce((acc, tx) => acc + tx.amount, 0)

      return sendSuccess(res, {
        totalCompanies: tenants.length,
        activeCompanies: tenants.filter((tenant) => tenant.status === TenantStatus.ACTIVE).length,
        suspendedCompanies: tenants.filter((tenant) => tenant.status === TenantStatus.SUSPENDED).length,
        totalCreditsAllocated: totalCredits,
      })
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch dashboard data', 500)
    }
  },

  async listCompanies(_req: Request, res: Response) {
    try {
      const tenants = await tenantService.listTenants()
      return sendSuccess(res, tenants)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch companies list', 500)
    }
  },

  async createCompany(req: Request, res: Response) {
    try {
      const { name, subdomain, adminEmail, adminFirstName, adminLastName, initialCredits } = req.body
      if (!name || !subdomain || !adminEmail || !adminFirstName || !adminLastName) {
        return sendError(res, 'All required administrative fields must be provided.', 400)
      }

      const tenant = await tenantService.createTenant({
        name,
        subdomain,
        adminEmail,
        adminFirstName,
        adminLastName,
        initialCredits: Number(initialCredits) || 0,
      })

      return sendSuccess(res, tenant, 'Company created successfully', 201)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to provision company', 400)
    }
  },

  async toggleCompanyStatus(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { status } = req.body
      
      if (!status || !Object.values(TenantStatus).includes(status)) {
        return sendError(res, 'A valid company status is required.', 400)
      }

      const existingTenant = await prisma.tenant.findUnique({ where: { id } })
      const previousStatus = existingTenant?.status

      const tenant = await tenantService.updateStatus(id, status as TenantStatus);

      // Send status change notification email asynchronously
      (async () => {
        try {
          // 1. Fetch admin user associated with this tenant
          const adminUser = await prisma.user.findFirst({
            where: {
              tenantId: id,
              role: UserRole.ADMIN,
            },
          })

          if (adminUser) {
            const adminName = `${adminUser.firstName} ${adminUser.lastName}`
            const tenantName = tenant.name
            const { onboardingService } = await import('../services/onboarding.service')
            const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined)
            const loginUrl = onboardingService.buildCompanyPortalUrl(existingTenant?.subdomain || undefined, origin)

            let subject = ''
            let htmlBody = ''

            if (status === TenantStatus.ACTIVE) {
              if (previousStatus === TenantStatus.PENDING) {
                // Initial welcome email
                let isDefaultPassword = false
                try {
                  isDefaultPassword = await comparePassword('Admin@123', adminUser.password)
                } catch (e) {
                  // ignore
                }
                const plainPasswordText = isDefaultPassword
                  ? 'Admin@123'
                  : '[The password you configured during registration]'
                const adminUsername = adminUser.username || adminUser.email

                subject = `HRMS Enterprise - ${tenantName} Enquiry Accepted`
                htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Enquiry Accepted</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #4f46e5;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .content {
      padding: 40px;
    }
    .content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Enquiry Accepted</h1>
      </div>
      <div class="content">
        <h2>Hello ${adminName},</h2>
        <p>Your enquiry for <strong>${tenantName}</strong> has been accepted!</p>
        <p>We are currently in the process of your company creation. A requesting documents email will be sent to you shortly.</p>
      </div>
      <div class="footer">
        <p>If you have any questions or require support, please contact our administrative team.</p>
        <p>&copy; 2026 HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
                `
              } else if (previousStatus === TenantStatus.SUSPENDED) {
                // Reactivation email
                subject = `HRMS Enterprise - ${tenantName} Account Reactivated`
                htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Reactivated</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #10b981;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
    }
    .content {
      padding: 40px;
    }
    .content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      background-color: #10b981;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 30px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      text-align: center;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Account Reactivated</h1>
      </div>
      <div class="content">
        <h2>Your Account is Active</h2>
        <p>Dear ${adminName},</p>
        <p>We are pleased to inform you that your company account for <strong>${tenantName}</strong> has been successfully reactivated by the administrator.</p>
        <p>You can now log back into your portal and continue managing your HR operations.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" class="btn">Go to Dashboard</a>
        </p>
      </div>
      <div class="footer">
        <p>If you have any questions, please reply to this email or contact support.</p>
        <p>&copy; 2026 HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
                `
              }
            } else if (status === TenantStatus.SUSPENDED) {
              // Suspension email
              subject = `HRMS Enterprise - ${tenantName} Account Suspended`
              htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Suspended</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #ef4444;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
    }
    .content {
      padding: 40px;
    }
    .content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Account Suspended</h1>
      </div>
      <div class="content">
        <h2>Your Account has been Suspended</h2>
        <p>Dear ${adminName},</p>
        <p>We regret to inform you that your company account for <strong>${tenantName}</strong> has been suspended by the administrator.</p>
        <p>While suspended, you and your employees will not be able to log in or access your portal data. To resolve this matter, please contact our administrative team immediately.</p>
      </div>
      <div class="footer">
        <p>If you believe this is an error, please contact administrative support.</p>
        <p>&copy; 2026 HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
              `
            }

            if (subject && htmlBody) {
              await notificationService.sendEmail(adminUser.email, subject, htmlBody)
            }
          }
        } catch (err) {
          console.error('[STATUS NOTIFICATION EMAIL ERROR] Failed to send status notification email:', err)
        }
      })()

      return sendSuccess(res, tenant, `Company status updated to ${status}`)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update company status', 400)
    }
  },

  async addCredits(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { amount, description } = req.body

      if (!amount || Number(amount) <= 0) {
        return sendError(res, 'A positive credit allocation amount is required.', 400)
      }
      
      const authRequest = req as any
      const superAdminId = authRequest.user?.id
      
      if (!superAdminId) {
        return sendError(res, 'Unauthorized: Super Admin not found', 401)
      }
      
      // Check Super Admin balance and deduct
      const superAdmin = await prisma.user.findUnique({ where: { id: superAdminId } })
      if (!superAdmin || superAdmin.credits < Number(amount)) {
        return sendError(res, 'Insufficient Super Admin credits to complete this allocation.', 400)
      }
      
      await prisma.user.update({
        where: { id: superAdminId },
        data: { credits: { decrement: Number(amount) } }
      })

      const tenant = await tenantService.addCredits(id, Number(amount), description || 'Credits granted by Super Admin')
      return sendSuccess(res, tenant, `Credits successfully allocated to ${tenant.name}`)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to allocate credits', 400)
    }
  },

  async deleteCompany(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { password } = req.body

      if (!password) {
        return sendError(res, 'Super Admin password is required to delete a company', 400)
      }

      // Get the authenticated Super Admin user from the request
      const authRequest = req as any
      const superAdminId = authRequest.user?.id

      if (!superAdminId) {
        return sendError(res, 'Unauthorized: Super Admin not found', 401)
      }

      // Fetch the Super Admin user to verify password
      const superAdmin = await prisma.user.findUnique({
        where: { id: superAdminId },
      })

      if (!superAdmin) {
        return sendError(res, 'Unauthorized: Super Admin not found', 401)
      }

      // Verify the password
      const isPasswordValid = await comparePassword(password, superAdmin.password)
      if (!isPasswordValid) {
        return sendError(res, 'Invalid Super Admin password', 401)
      }

      // Proceed with deletion
      await tenantService.deleteTenant(id)
      return sendSuccess(res, null, 'Company and all associated data deleted successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete company', 400)
    }
  },

  async createCompanyWithFullDetails(req: Request, res: Response) {
    try {
      const { hashPassword } = await import('../utils/password.utils')
      const { v4: uuidv4 } = await import('uuid')
      const InvoiceService = (await import('../services/invoice.service')).default

      // Extract form data
      const body = req.body as any

      // Basic Company Information
      const companyName = body.companyName
      const legalCompanyName = body.legalCompanyName
      const industryType = body.industryType
      const businessType = body.businessType
      const websiteUrl = body.websiteUrl || ''
      const companyDescription = body.companyDescription || ''

      // Contact Information
      const officialEmail = body.officialEmail
      const officialPhoneNumber = body.officialPhoneNumber
      const alternateContactNumber = body.alternateContactNumber || ''

      // Address Details
      const country = body.country
      const state = body.state
      const city = body.city
      const addressLine1 = body.addressLine1
      const addressLine2 = body.addressLine2 || ''
      const postalCode = body.postalCode

      // Company Admin Details
      const adminFullName = body.adminFullName
      const adminEmail = body.adminEmail
      const adminMobileNumber = body.adminMobileNumber
      const username = body.username
      const password = body.password

      // Subscription/Plan Management
      const planType = body.planType
      const subscriptionStartDate = body.subscriptionStartDate
      const subscriptionDuration = body.subscriptionDuration
      const subscriptionEndDate = body.subscriptionEndDate

      // Compliance & Tax Information
      const gstNumber = body.gstNumber || ''
      const panNumber = body.panNumber || ''
      const registrationNumber = body.registrationNumber || ''
      const taxIdentificationNumber = body.taxIdentificationNumber || ''

      // Security & Access
      const enableTwoFactorAuth = body.enableTwoFactorAuth === 'true'
      const allowedLoginDomains = body.allowedLoginDomains || ''
      const ipRestrictionEnabled = body.ipRestrictionEnabled === 'true'

      // Razorpay Payment Details
      const razorpayPaymentId = body.razorpayPaymentId || ''
      const razorpayOrderId = body.razorpayOrderId || ''
      const razorpaySignature = body.razorpaySignature || ''

      let subdomainPrefix = body.subdomainPrefix ? body.subdomainPrefix.toLowerCase() : ''
      if (!subdomainPrefix || subdomainPrefix.trim() === '') {
        subdomainPrefix = companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString(36)
      }

      // Validate required fields
      if (!companyName || !legalCompanyName || !industryType || !businessType) {
        return sendError(res, 'All required company information fields must be provided', 400)
      }

      if (!officialEmail || !officialPhoneNumber) {
        return sendError(res, 'Contact information is required', 400)
      }

      if (!country || !state || !city || !addressLine1 || !postalCode) {
        return sendError(res, 'Address details are required', 400)
      }

      if (!adminFullName || !adminEmail || !adminMobileNumber || !username || !password) {
        return sendError(res, 'Admin details are required', 400)
      }

      if (!planType || !subscriptionStartDate || !subscriptionDuration || !subscriptionEndDate) {
        return sendError(res, 'Subscription details are required', 400)
      }

      // Validate subdomain format (only check if it was explicitly provided)
      if (body.subdomainPrefix && !/^[a-z0-9-]+$/.test(body.subdomainPrefix)) {
        return sendError(res, 'Subdomain must contain only lowercase letters, numbers, and hyphens', 400)
      }

      // Check if subdomain already exists
      let existingTenant = await prisma.tenant.findUnique({
        where: { subdomain: subdomainPrefix },
      })
      
      // If it exists and we auto-generated it, try appending random characters
      if (existingTenant && (!body.subdomainPrefix || body.subdomainPrefix.trim() === '')) {
         subdomainPrefix = subdomainPrefix + '-' + Math.floor(Math.random() * 1000)
         existingTenant = await prisma.tenant.findUnique({
           where: { subdomain: subdomainPrefix },
         })
      }

      if (existingTenant) {
        return sendError(res, 'Subdomain already exists. Please choose a different one.', 400)
      }

      // Check if admin email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
      })

      if (existingUser) {
        return sendError(res, 'Admin email already exists', 400)
      }

      // Check if username already exists
      const existingUsername = await prisma.user.findUnique({
        where: { username },
      })

      if (existingUsername) {
        return sendError(res, 'Username already exists', 400)
      }

      // Generate company code
      const companyCode = `CMP-${uuidv4().substring(0, 8).toUpperCase()}`

      // Hash admin password
      const hashedPassword = await hashPassword(password)

      // Deduct from Super Admin
      const authRequest = req as any
      const superAdminId = authRequest.user?.id
      if (superAdminId) {
        const superAdmin = await prisma.user.findUnique({ where: { id: superAdminId } })
        if (superAdmin && superAdmin.credits >= 1000) {
          await prisma.user.update({
            where: { id: superAdminId },
            data: { credits: { decrement: 1000 } }
          })
        }
      }

      // Create tenant with all details
      const tenant = await prisma.tenant.create({
        data: {
          name: companyName,
          subdomain: subdomainPrefix,
          status: 'ACTIVE',
          credits: 1000, // Default initial credits (1 credit = ₹1)
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Create admin user
      const nameParts = adminFullName.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const resetToken = require('crypto').randomBytes(32).toString('hex')
      const resetExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const adminUser = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          username,
          password: hashedPassword,
          role: 'ADMIN',
          firstName,
          lastName,
          phone: adminMobileNumber,
          isActive: true,
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Create company settings record
      await prisma.featureFlag.createMany({
        data: [
          { tenantId: tenant.id, feature: 'two_factor_auth', enabled: enableTwoFactorAuth },
          { tenantId: tenant.id, feature: 'ip_restriction', enabled: ipRestrictionEnabled },
        ],
      })

      // Ensure SubscriptionPlan exists
      let plan = await prisma.subscriptionPlan.findUnique({ where: { name: planType } })
      if (!plan) {
        plan = await prisma.subscriptionPlan.create({
          data: {
            name: planType,
            price: planType === 'Starter' ? 999 : planType === 'Professional' ? 2499 : planType === 'Enterprise' ? 4999 : 0
          }
        })
      }
      
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { planId: plan.id }
      })

      // Company Settings
      await prisma.companySetting.create({
        data: {
          tenantId: tenant.id,
          companyCode,
          legalCompanyName,
          industryType,
          businessType,
          websiteUrl,
          companyDescription,
          officialEmail,
          officialPhoneNumber,
          alternateContactNumber,
          country,
          state,
          city,
          addressLine1,
          addressLine2,
          postalCode,
          gstNumber,
          panNumber,
          registrationNumber,
          taxIdentificationNumber,
          subscriptionStartDate: new Date(subscriptionStartDate),
          subscriptionEndDate: new Date(subscriptionEndDate),
          subscriptionDuration
        }
      })

      // Store additional company metadata in audit log
      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          action: 'COMPANY_CREATED',
          entity: 'Tenant',
          entityId: tenant.id,
          details: {
            legalCompanyName,
            industryType,
            businessType,
            websiteUrl,
            companyDescription,
            officialEmail,
            officialPhoneNumber,
            alternateContactNumber,
            country,
            state,
            city,
            addressLine1,
            addressLine2,
            postalCode,
            gstNumber,
            panNumber,
            registrationNumber,
            taxIdentificationNumber,
            allowedLoginDomains,
            companyCode,
            planType,
            subscriptionStartDate,
            subscriptionDuration,
            subscriptionEndDate,
          },
          ipAddress: req.ip,
          createdAt: new Date(),
        },
      })

      // Generate invoice
      const invoiceData = InvoiceService.generateInvoiceData({
        companyName,
        legalCompanyName,
        gstNumber,
        panNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        planType,
        subscriptionDuration,
        subscriptionStartDate,
        subscriptionEndDate,
      })
      
      // Override invoice transaction ID if razorpay payment ID is present
      if (razorpayPaymentId) {
        invoiceData.transactionId = razorpayPaymentId
        invoiceData.paymentMethod = 'Razorpay'
      }

      const invoicePDF = await InvoiceService.generatePDFInvoice(invoiceData)
      await InvoiceService.createInvoiceRecord(invoiceData, tenant.id, prisma)

      // Send onboarding email asynchronously
      ;(async () => {
        try {
          const { onboardingService } = await import('../services/onboarding.service')
          const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined)
          const loginUrl = onboardingService.buildCompanyPortalUrl(subdomainPrefix, origin)
          const subdomainUrl = new URL(loginUrl).host

          const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to HRMS Portal – Your Company Account is Ready</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #4f46e5;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .content {
      padding: 40px;
    }
    .content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .creds-box {
      background-color: #f1f5f9;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
      border: 1px solid #e2e8f0;
    }
    .creds-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 16px;
    }
    .creds-row {
      margin-bottom: 12px;
      font-size: 15px;
    }
    .creds-row:last-child {
      margin-bottom: 0;
    }
    .creds-label {
      font-weight: 600;
      color: #475569;
      display: inline-block;
      width: 140px;
    }
    .creds-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0f172a;
      font-weight: bold;
    }
    .btn {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 30px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.2);
    }
    .subscription-info {
      background-color: #ecfdf5;
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .subscription-info h3 {
      color: #065f46;
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    .subscription-info p {
      color: #047857;
      margin: 0;
      font-size: 14px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Welcome to HRMS Portal</h1>
      </div>
      <div class="content">
        <h2>Your Company Account is Ready</h2>
        <p>Hello ${adminFullName},</p>
        <p>Your company account for <strong>${companyName}</strong> has been successfully created. You can now access your HRMS dashboard and manage your workforce.</p>
        
        <div class="subscription-info">
          <h3>📋 Subscription Details</h3>
          <p><strong>Plan:</strong> ${planType}</p>
          <p><strong>Duration:</strong> ${subscriptionDuration}</p>
          <p><strong>Valid Until:</strong> ${new Date(subscriptionEndDate).toLocaleDateString()}</p>
        </div>
        
        <p>Please use the following credentials to log in:</p>
        
        <div class="creds-box">
          <div class="creds-title">Login Credentials</div>
          <div class="creds-row">
            <span class="creds-label">Workspace:</span>
            <span class="creds-value">https://hrmsvrpigroup.com/login</span>
          </div>
          <div class="creds-row">
            <span class="creds-label">Login URL:</span>
            <span class="creds-value">https://hrmsvrpigroup.com/login</span>
          </div>
          <div class="creds-row">
            <span class="creds-label">Username:</span>
            <span class="creds-value">${username}</span>
          </div>
          <div class="creds-row">
            <span class="creds-label">Password:</span>
            <span class="creds-value">${password}</span>
          </div>
        </div>
        
        <p style="color: #dc2626; font-weight: 600; font-size: 14px;">⚠️ Please reset your password after first login for security.</p>
        
        <div style="text-align: center; margin-top: 32px; margin-bottom: 16px;">
          <a href="${loginUrl}" class="btn" target="_blank">Access Your Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p>If you have any questions or require support, please contact our administrative team.</p>
        <p>&copy; 2026 HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
          `

          const attachments = [{
            filename: `Invoice_${invoiceData.invoiceNumber}.pdf`,
            content: invoicePDF
          }]

          const subject = `Welcome to HRMS Portal – ${companyName} Account Ready`
          await notificationService.sendEmail(adminEmail, subject, htmlBody, undefined, attachments)
        } catch (err) {
          console.error('[ONBOARDING EMAIL ERROR] Failed to send onboarding email:', err)
        }
      })()

      // Deduct subscription credits if payment was made
      let finalCredits = tenant.credits
      if (razorpayPaymentId && razorpayPaymentId !== '') {
        try {
          const updatedTenant = await tenantService.deductSubscriptionCredits(
            tenant.id,
            planType,
            subscriptionDuration
          )
          finalCredits = updatedTenant.credits

          // Record payment transaction
          await prisma.paymentTransaction.create({
            data: {
              tenantId: tenant.id,
              amount: 0, // Amount is in credits, not rupees
              status: 'SUCCESS',
              paymentMethod: 'Razorpay',
              transactionId: razorpayPaymentId,
            },
          })
        } catch (creditError: any) {
          console.error('[SUBSCRIPTION CREDIT ERROR] Failed to deduct subscription credits:', creditError)
          // Don't fail the entire company creation, just log the error
        }
      }

      return sendSuccess(
        res,
        {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: tenant.status,
          credits: finalCredits,
          companyCode,
          adminUser: {
            id: adminUser.id,
            email: adminUser.email,
            username: adminUser.username,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
          },
        },
        'Company created successfully. Onboarding email has been sent.',
        201
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create company with full details', 400)
    }
  },

  async downloadInvoice(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await prisma.invoice.findFirst({ where: { tenantId: id }, orderBy: { createdAt: 'desc' } })
      if (!invoice) return sendError(res, 'Invoice not found', 404)
      
      const tenant = await prisma.tenant.findUnique({ where: { id } })
      const companySetting = await prisma.companySetting.findUnique({ where: { tenantId: id } })
      
      const InvoiceService = (await import('../services/invoice.service')).default
      
      const invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        companyName: tenant?.name || 'Company',
        legalCompanyName: companySetting?.legalCompanyName || '',
        gstNumber: companySetting?.gstNumber || 'N/A',
        panNumber: companySetting?.panNumber || 'N/A',
        address: {
          line1: companySetting?.addressLine1 || '',
          line2: companySetting?.addressLine2 || '',
          city: companySetting?.city || '',
          state: companySetting?.state || '',
          postalCode: companySetting?.postalCode || '',
          country: companySetting?.country || '',
        },
        planType: tenant?.planId ? 'Subscription Plan' : 'Custom Plan',
        subscriptionDuration: invoice.subscriptionPeriod || 'Monthly',
        subscriptionStartDate: companySetting?.subscriptionStartDate?.toISOString() || new Date().toISOString(),
        subscriptionEndDate: companySetting?.subscriptionEndDate?.toISOString() || new Date().toISOString(),
        billingAmount: invoice.billingAmount,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        paymentMethod: invoice.paymentMethod,
        transactionId: invoice.transactionId || '',
        invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
      }
      
      const invoicePDF = await InvoiceService.generatePDFInvoice(invoiceData as any)
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`);
      return res.send(invoicePDF);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to download invoice', 500)
    }
  },

  async sendDocumentRequest(req: Request, res: Response) {
    try {
      const { id } = req.params

      // Fetch tenant and admin details
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          users: {
            where: { role: UserRole.ADMIN },
            select: { email: true, firstName: true, lastName: true },
          },
        },
      })

      if (!tenant) {
        return sendError(res, 'Company not found', 404)
      }

      const adminUser = tenant.users[0]
      if (!adminUser) {
        return sendError(res, 'No admin user found for this company', 404)
      }

      // Required documents list
      const requiredDocuments = [
        'Company Registration Certificate',
        'GST Registration Certificate',
        'PAN Card',
        'Address Proof (Utility Bill / Lease Agreement)',
        'Bank Account Details',
        'Authorized Signatory ID Proof',
        'Board Resolution (if applicable)',
        'MOA & AOA (Memorandum and Articles of Association)',
      ]

      // Build email HTML
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document Request - HRMS Portal</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #f59e0b;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .content {
      padding: 40px;
    }
    .content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .alert-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .alert-box p {
      margin: 0;
      color: #92400e;
      font-weight: 600;
      font-size: 15px;
    }
    .doc-list {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
      border: 1px solid #e2e8f0;
    }
    .doc-list-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
    }
    .doc-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 15px;
      color: #475569;
    }
    .doc-item:last-child {
      border-bottom: none;
    }
    .doc-item-icon {
      width: 24px;
      height: 24px;
      background-color: #dbeafe;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      font-size: 14px;
      flex-shrink: 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>📄 Document Request</h1>
      </div>
      <div class="content">
        <h2>Required Documents for ${tenant.name}</h2>
        <p>Dear ${adminUser.firstName} ${adminUser.lastName},</p>
        <p>We are writing to request the following documents for your company registration with HRMS Portal. These documents are required to complete your account verification and activation process.</p>
        
        <div class="alert-box">
          <p>⚠️ Please submit these documents at your earliest convenience to avoid any delays in account activation.</p>
        </div>
        
        <div class="doc-list">
          <div class="doc-list-title">Required Documents Checklist:</div>
          ${requiredDocuments.map((doc, index) => `
            <div class="doc-item">
              <div class="doc-item-icon">${index + 1}</div>
              <span>${doc}</span>
            </div>
          `).join('')}
        </div>
        
        <p><strong>Submission Instructions:</strong></p>
        <ul style="color: #475569; line-height: 1.8; margin-bottom: 24px;">
          <li>All documents should be in PDF format</li>
          <li>File size should not exceed 5MB per document</li>
          <li>Documents should be clear and legible</li>
          <li>Please ensure all documents are valid and up-to-date</li>
        </ul>
        
        <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center;">
          <p style="font-size: 18px; font-weight: 700; color: #1e40af; margin: 0 0 12px 0;">📧 How to Submit Documents</p>
          <p style="font-size: 16px; color: #1e3a8a; margin: 0 0 8px 0; font-weight: 600;">Please send all required documents to:</p>
          <p style="font-size: 20px; font-weight: 800; color: #1e40af; margin: 0; font-family: monospace;">vrpigroup@gmail.com</p>
          <p style="font-size: 14px; color: #475569; margin: 16px 0 0 0;">Reply to this email with the documents attached</p>
        </div>
        
        <p style="font-size: 14px; color: #64748b; margin-top: 32px;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      </div>
      <div class="footer">
        <p>Thank you for your cooperation.</p>
        <p>&copy; 2026 HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
      `

      // Send email to admin's email address
      const recipientEmail = adminUser.email
      const subject = `Document Request - ${tenant.name} | HRMS Portal`
      await notificationService.sendEmail(recipientEmail, subject, htmlBody)

      // Log the document request in audit log
      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: (req as any).user?.id,
          action: 'DOCUMENT_REQUEST_SENT',
          entity: 'Tenant',
          entityId: tenant.id,
          details: {
            recipientEmail: recipientEmail,
            recipientName: `${adminUser.firstName} ${adminUser.lastName}`,
            documentsRequested: requiredDocuments,
            companyName: tenant.name,
          },
          ipAddress: req.ip,
          createdAt: new Date(),
        },
      })

      return sendSuccess(res, { sent: true }, `Document request email sent to ${recipientEmail}`)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to send document request', 500)
    }
  },

  async getCompany(req: Request, res: Response) {
    try {
      const { id } = req.params
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          users: {
            where: { role: UserRole.ADMIN },
          },
          companySetting: true,
          featureFlags: true
        }
      })
      if (!tenant) {
        return sendError(res, 'Company not found', 404)
      }
      return sendSuccess(res, tenant)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch company details', 500)
    }
  },

  async updateCompanyFull(req: Request, res: Response) {
    try {
      const { id } = req.params
      const body = req.body as any
      const files = req.files as any

      // 1. Fetch current tenant and admin user
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          users: { where: { role: UserRole.ADMIN } },
          companySetting: true
        }
      })
      if (!tenant) {
        return sendError(res, 'Company not found', 404)
      }
      const adminUser = tenant.users?.[0]

      // Extract text body fields
      const {
        companyName, legalCompanyName, industryType, businessType,
        websiteUrl, companyDescription, subdomainPrefix,
        officialEmail, officialPhoneNumber, alternateContactNumber,
        country, state, city, addressLine1, addressLine2, postalCode,
        adminFullName, adminEmail, adminMobileNumber, username, password,
        planType, subscriptionStartDate, subscriptionDuration, subscriptionEndDate,
        gstNumber, panNumber, registrationNumber, taxIdentificationNumber,
        enableTwoFactorAuth, allowedLoginDomains, ipRestrictionEnabled,
        credits
      } = body

      // Validate required fields
      if (!companyName || !legalCompanyName || !industryType || !businessType) {
        return sendError(res, 'All required company information fields must be provided', 400)
      }

      // Check subdomain duplicate if subdomain is changed
      const currentSubdomain = tenant.subdomain
      const newSubdomain = subdomainPrefix ? subdomainPrefix.toLowerCase() : currentSubdomain
      if (newSubdomain !== currentSubdomain) {
        const duplicateSubdomain = await prisma.tenant.findUnique({
          where: { subdomain: newSubdomain }
        })
        if (duplicateSubdomain) {
          return sendError(res, 'Subdomain is already in use by another company.', 400)
        }
      }

      // Check admin email duplicate if changed
      if (adminUser && adminEmail && adminEmail !== adminUser.email) {
        const duplicateEmail = await prisma.user.findUnique({
          where: { email: adminEmail }
        })
        if (duplicateEmail) {
          return sendError(res, 'Admin email is already in use.', 400)
        }
      }

      // Check username duplicate if changed
      if (adminUser && username && username !== adminUser.username) {
        const duplicateUsername = await prisma.user.findUnique({
          where: { username }
        })
        if (duplicateUsername) {
          return sendError(res, 'Username is already in use.', 400)
        }
      }

      // Prepare file paths
      let logoUrl = tenant.logoUrl
      if (files?.companyLogo?.[0]) {
        logoUrl = `/uploads/companies/${files.companyLogo[0].filename}`
      }

      let registrationDocs = [...tenant.registrationDocs]
      if (files?.companyRegistrationCertificate?.[0]) {
        registrationDocs.push(`/uploads/companies/${files.companyRegistrationCertificate[0].filename}`)
      }
      if (files?.taxDocuments?.[0]) {
        registrationDocs.push(`/uploads/companies/${files.taxDocuments[0].filename}`)
      }
      if (files?.ndaAgreements?.[0]) {
        registrationDocs.push(`/uploads/companies/${files.ndaAgreements[0].filename}`)
      }

      // Find plan ID
      let planId = tenant.planId
      if (planType) {
        let plan = await prisma.subscriptionPlan.findUnique({ where: { name: planType } })
        if (!plan) {
          plan = await prisma.subscriptionPlan.create({
            data: {
              name: planType,
              price: planType === 'Starter' ? 999 : planType === 'Professional' ? 2499 : planType === 'Enterprise' ? 4999 : 0
            }
          })
        }
        planId = plan.id
      }

      // Start transaction to update everything
      const updatedTenant = await prisma.$transaction(async (tx) => {
        // 1. Update Tenant
        const updated = await tx.tenant.update({
          where: { id },
          data: {
            name: companyName,
            subdomain: newSubdomain,
            credits: credits !== undefined ? Number(credits) : tenant.credits,
            logoUrl,
            registrationDocs,
            planId,
          }
        })

        // 2. Update Admin User
        if (adminUser) {
          const nameParts = adminFullName ? adminFullName.split(' ') : []
          const firstName = nameParts[0] || adminUser.firstName
          const lastName = nameParts.slice(1).join(' ') || adminUser.lastName

          let hashedPassword = adminUser.password
          if (password && password.trim() !== '') {
            const { hashPassword } = await import('../utils/password.utils')
            hashedPassword = await hashPassword(password)
          }

          await tx.user.update({
            where: { id: adminUser.id },
            data: {
              email: adminEmail || adminUser.email,
              username: username || adminUser.username,
              password: hashedPassword,
              firstName,
              lastName,
              phone: adminMobileNumber || adminUser.phone,
            }
          })
        }

        // 3. Update or Create CompanySetting
        const settingData = {
          legalCompanyName,
          industryType,
          businessType,
          websiteUrl,
          companyDescription,
          officialEmail,
          officialPhoneNumber,
          alternateContactNumber,
          country,
          state,
          city,
          addressLine1,
          addressLine2,
          postalCode,
          gstNumber,
          panNumber,
          registrationNumber,
          taxIdentificationNumber,
          subscriptionStartDate: subscriptionStartDate ? new Date(subscriptionStartDate) : undefined,
          subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : undefined,
          subscriptionDuration
        }

        if (tenant.companySetting) {
          await tx.companySetting.update({
            where: { tenantId: id },
            data: settingData
          })
        } else {
          await tx.companySetting.create({
            data: {
              tenantId: id,
              companyCode: `CMP-${require('uuid').v4().substring(0, 8).toUpperCase()}`,
              ...settingData
            }
          })
        }

        // 4. Update Security Flags
        if (enableTwoFactorAuth !== undefined) {
          await tx.featureFlag.upsert({
            where: { tenantId_feature: { tenantId: id, feature: 'two_factor_auth' } },
            update: { enabled: enableTwoFactorAuth === 'true' || enableTwoFactorAuth === true },
            create: { tenantId: id, feature: 'two_factor_auth', enabled: enableTwoFactorAuth === 'true' || enableTwoFactorAuth === true }
          })
        }
        if (ipRestrictionEnabled !== undefined) {
          await tx.featureFlag.upsert({
            where: { tenantId_feature: { tenantId: id, feature: 'ip_restriction' } },
            update: { enabled: ipRestrictionEnabled === 'true' || ipRestrictionEnabled === true },
            create: { tenantId: id, feature: 'ip_restriction', enabled: ipRestrictionEnabled === 'true' || ipRestrictionEnabled === true }
          })
        }

        return updated
      })

      return sendSuccess(res, updatedTenant, 'Company details updated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update company details', 400)
    }
  },

  async getDocuments(req: Request, res: Response) {
    try {
      const documents = await prisma.tenantDocument.findMany({
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true, companySetting: { select: { companyCode: true } } }
          }
        },
        orderBy: { uploadedAt: 'desc' },
      })
      
      const formatted = documents.map(doc => ({
        ...doc,
        companyCode: doc.tenant?.companySetting?.companyCode || 'N/A'
      }))
      
      return sendSuccess(res, formatted)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch documents', 500)
    }
  },

  async uploadDocument(req: Request, res: Response) {
    try {
      const { tenantId, type } = req.body
      if (!tenantId || !type) return sendError(res, 'tenantId and type are required', 400)

      const file = req.file
      if (!file) return sendError(res, 'No file uploaded', 400)

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
      if (!tenant) return sendError(res, 'Company not found', 404)

      const relativeUrl = `/uploads/companies/${file.filename}`
      
      const document = await prisma.tenantDocument.create({
        data: {
          tenantId,
          name: file.originalname,
          type,
          fileUrl: relativeUrl,
          fileSize: file.size,
        }
      })

      return sendSuccess(res, document)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to upload document', 500)
    }
  },

  async replaceDocument(req: Request, res: Response) {
    try {
      const { id } = req.params
      const file = req.file
      if (!file) return sendError(res, 'No file uploaded', 400)

      const existingDoc = await prisma.tenantDocument.findUnique({
        where: { id }
      })
      
      if (!existingDoc) return sendError(res, 'Document not found', 404)

      // Delete old physical file
      const fs = require('fs')
      const path = require('path')
      const oldFilePath = path.join(process.cwd(), existingDoc.fileUrl)
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath)
      }

      // Update DB with new file
      const relativeUrl = `/uploads/companies/${file.filename}`
      const updatedDoc = await prisma.tenantDocument.update({
        where: { id },
        data: {
          name: file.originalname,
          fileUrl: relativeUrl,
          fileSize: file.size,
          uploadedAt: new Date(),
        }
      })

      return sendSuccess(res, updatedDoc)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to replace document', 500)
    }
  },

  async deleteDocument(req: Request, res: Response) {
    try {
      const { id } = req.params

      const existingDoc = await prisma.tenantDocument.findUnique({
        where: { id }
      })

      if (!existingDoc) return sendError(res, 'Document not found', 404)

      // Delete physical file
      const fs = require('fs')
      const path = require('path')
      const cleanedUrl = existingDoc.fileUrl.startsWith('/') ? existingDoc.fileUrl.slice(1) : existingDoc.fileUrl
      const filePath = path.join(process.cwd(), cleanedUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      // Delete from DB
      await prisma.tenantDocument.delete({
        where: { id }
      })

      return sendSuccess(res, null, 'Document deleted successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete document', 500)
    }
  },

  async resendCredentials(req: Request, res: Response) {
    try {
      const { id } = req.params

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          companySetting: true,
          plan: true,
        }
      })

      if (!tenant) return sendError(res, 'Company not found', 404)

      const adminUser = await prisma.user.findFirst({
        where: { tenantId: id, role: 'ADMIN' }
      })

      if (!adminUser) return sendError(res, 'Company admin not found', 404)

      // Generate a new password
      const newPassword = `Admin@${Math.floor(1000 + Math.random() * 9000)}`
      const { hashPassword } = await import('../utils/password.utils')
      const hashedPassword = await hashPassword(newPassword)

      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: hashedPassword }
      })

      // Send email
      const { onboardingService } = await import('../services/onboarding.service')
      const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined)
      const loginUrl = onboardingService.buildCompanyPortalUrl(tenant.subdomain || '', origin)
      const companyName = tenant.name
      const adminFullName = `${adminUser.firstName} ${adminUser.lastName}`
      const planType = tenant.plan?.name || 'Starter'
      const subscriptionDuration = tenant.companySetting?.subscriptionDuration || '12 months'
      const subscriptionEndDate = tenant.companySetting?.subscriptionEndDate || new Date()

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to HRMS Portal – Your Company Account is Ready</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 20px; box-sizing: border-box; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background-color: #4f46e5; padding: 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
    .content { padding: 40px; }
    .content h2 { color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px; }
    .content p { font-size: 16px; line-height: 1.6; color: #475569; margin-top: 0; margin-bottom: 24px; }
    .creds-box { background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #e2e8f0; }
    .creds-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 16px; }
    .creds-row { margin-bottom: 12px; font-size: 15px; }
    .creds-label { font-weight: 600; color: #475569; display: inline-block; width: 140px; }
    .creds-value { font-family: monospace; color: #0f172a; font-weight: bold; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 700; }
    .subscription-info { background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .subscription-info h3 { color: #065f46; margin: 0 0 8px 0; font-size: 16px; }
    .subscription-info p { color: #047857; margin: 0; font-size: 14px; }
    .footer { background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Welcome to HRMS Portal</h1>
      </div>
      <div class="content">
        <h2>Your Company Account Credentials</h2>
        <p>Hello ${adminFullName},</p>
        <p>We are resending your company account credentials for <strong>${companyName}</strong>.</p>
        
        <div class="subscription-info">
          <h3>📋 Subscription Details</h3>
          <p><strong>Plan:</strong> ${planType}</p>
          <p><strong>Duration:</strong> ${subscriptionDuration}</p>
          <p><strong>Valid Until:</strong> ${new Date(subscriptionEndDate).toLocaleDateString()}</p>
        </div>
        
        <p>Please use the following credentials to log in:</p>
        
        <div class="creds-box">
          <div class="creds-title">Login Credentials</div>
          <div class="creds-row">
            <span class="creds-label">Workspace:</span>
            <span class="creds-value">https://hrmsvrpigroup.com/login</span>
          </div>
          <div class="creds-row">
            <span class="creds-label">Username:</span>
            <span class="creds-value">${adminUser.username || adminUser.email}</span>
          </div>
          <div class="creds-row">
            <span class="creds-label">Password:</span>
            <span class="creds-value">${newPassword}</span>
          </div>
        </div>
        
        <p style="color: #dc2626; font-weight: 600; font-size: 14px;">⚠️ Please reset your password after first login for security.</p>
        
        <div style="text-align: center; margin-top: 32px; margin-bottom: 16px;">
          <a href="${loginUrl}" class="btn" target="_blank">Access Your Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p>If you have any questions or require support, please contact our administrative team.</p>
        <p>&copy; 2026 HRMS Enterprise. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
      `

      const subject = `Resend Credentials – ${companyName} Account Ready`
      let emailSuccess = false
      let emailWarningMsg = ''
      try {
        await notificationService.sendEmail(adminUser.email, subject, htmlBody)
        emailSuccess = true
      } catch (err: any) {
        emailWarningMsg = err.message || 'Email delivery failed'
        console.error('[RESEND CREDENTIALS EMAIL WARNING]', err)
      }

      const msg = emailSuccess
        ? 'Credentials have been regenerated and resent successfully.'
        : `Credentials regenerated! (Email dispatch notice: ${emailWarningMsg}. Temporary Password: ${newPassword})`

      return sendSuccess(res, {
        emailSent: emailSuccess,
        adminEmail: adminUser.email,
        temporaryPassword: newPassword,
        loginUrl
      }, msg)
    } catch (error: any) {
      console.error('[RESEND CREDENTIALS ERROR]', error)
      return sendError(res, error.message || 'Failed to resend credentials', 500)
    }
  }
}
