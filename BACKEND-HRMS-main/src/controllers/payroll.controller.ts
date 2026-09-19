import { Response } from 'express'
import fs from 'fs'
import path from 'path'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { payrollService } from '../services/payroll.service'
import { PayslipService } from '../services/payslip.service'
import { sendError, sendSuccess } from '../utils/response.utils'
const pdfParse = require('pdf-parse')

export const payrollController = {
  async list(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    try {
      if (req.user?.role === 'EMPLOYEE') {
        let employee = await prisma.employee.findUnique({ where: { userId: req.user.id } })
        if (!employee && req.user.email) {
          employee = await prisma.employee.findFirst({
            where: {
              tenantId,
              email: { equals: req.user.email, mode: 'insensitive' },
            },
          })
        }
        if (!employee) return sendError(res, 'Employee profile not found', 404)
        
        const items = await prisma.payroll.findMany({
          where: { tenantId, employeeId: employee.id },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        })
        return sendSuccess(res, items)
      } else {
        const items = await payrollService.listByTenant(tenantId)
        return sendSuccess(res, items)
      }
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to list payroll', 500)
    }
  },

  async downloadPayslip(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)
    
    try {
      const { id } = req.params
      const payroll = await prisma.payroll.findUnique({
        where: { id, tenantId },
        include: {
          employee: {
            include: {
              tenant: true,
              designation: true,
              payrollDetails: true,
              addressInfo: true,
            },
          },
        },
      })

      if (!payroll) return sendError(res, 'Payslip not found', 404)

      // Ensure employees can only download their own payslips
      if (req.user?.role === 'EMPLOYEE') {
        const isOwner = (payroll.employee.userId && payroll.employee.userId === req.user.id) ||
                        (payroll.employee.email && req.user.email && payroll.employee.email.toLowerCase() === req.user.email.toLowerCase())
        if (!isOwner) {
          return sendError(res, 'Unauthorized to view this payslip', 403)
        }
      }

      let pdfBuffer: Buffer | null = null

      // 1. Check if file exists on disk
      if (payroll.slipUrl) {
        const cleanSlipUrl = payroll.slipUrl.startsWith('/') ? payroll.slipUrl.slice(1) : payroll.slipUrl
        const candidates = [
          path.join(process.cwd(), cleanSlipUrl),
          path.join(process.cwd(), 'public', cleanSlipUrl),
          path.join(process.cwd(), 'uploads', 'payslips', path.basename(payroll.slipUrl)),
          path.join(process.cwd(), 'public', 'uploads', 'payslips', path.basename(payroll.slipUrl)),
          path.join(__dirname, '../../public', cleanSlipUrl),
        ]

        const resolvedPath = candidates.find(p => fs.existsSync(p))
        if (resolvedPath) {
          try {
            pdfBuffer = fs.readFileSync(resolvedPath)
          } catch (readErr) {
            console.warn('Could not read existing payslip file, regenerating:', readErr)
          }
        }
      }

      // 2. If not found on disk (e.g. Render ephemeral storage, redeploys, or deleted files), generate dynamically on the fly!
      if (!pdfBuffer) {
        const emp = payroll.employee
        const tenant = emp.tenant
        const details = emp.payrollDetails

        const MONTHS = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ]

        const totalDays = new Date(payroll.year, payroll.month, 0).getDate()

        let basic = payroll.basicSalary || 0
        let hra = payroll.hra || 0
        let allowances = payroll.allowances || 0
        const deductions = payroll.deductions || (payroll.pf + payroll.tax)
        const netSalary = payroll.netSalary || 0

        // Derive balanced breakdown if earnings are zero
        if (basic === 0 && hra === 0 && allowances === 0 && netSalary > 0) {
          const gross = netSalary + deductions
          basic = Math.round(gross * 0.5)
          hra = Math.round(gross * 0.3)
          allowances = Math.max(0, gross - basic - hra)

          prisma.payroll.update({
            where: { id: payroll.id },
            data: { basicSalary: basic, hra, allowances },
          }).catch(() => {})
        }

        const lta = Math.min(3000, allowances)
        const specialAllowance = Math.max(0, allowances - lta)
        const pfDeduction = payroll.pf
        const professionalTax = payroll.tax
        const otherDeductions = Math.max(0, deductions - pfDeduction - professionalTax)

        const payslipData = {
          companyName: tenant?.name || 'VR PI TECH SOLUTIONS LLP',
          companyLogoUrl: tenant?.logoUrl || null,
          subdomain: tenant?.subdomain || '',
          employeeCode: emp.employeeCode,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          designation: emp.designation?.title || 'Employee',
          location: emp.addressInfo?.city || 'Hyderabad',
          panNumber: details?.panNumber || '',
          joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
          bankName: details?.bankName || '',
          bankAccountNumber: details?.accountNumber || '',
          uanNumber: details?.uanNumber || '',
          pfNumber: details?.uanNumber ? 'PF-' + details.uanNumber : '-',
          esicNumber: details?.esiEnabled ? 'ESIC-' + emp.employeeCode : '-',
          daysPaid: totalDays,
          lossOfPay: 0,
          monthName: MONTHS[payroll.month - 1] || `Month ${payroll.month}`,
          year: payroll.year,
          basic,
          hra,
          lta,
          specialAllowance,
          professionalTax,
          pfDeduction,
          otherDeductions,
          netSalary,
        }

        pdfBuffer = await PayslipService.generatePayslipPDF(payslipData)

        // Cache generated PDF to disk so subsequent reads are instant
        try {
          const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'payslips')
          const regularUploadsDir = path.join(process.cwd(), 'uploads', 'payslips')
          if (!fs.existsSync(publicUploadsDir)) fs.mkdirSync(publicUploadsDir, { recursive: true })
          if (!fs.existsSync(regularUploadsDir)) fs.mkdirSync(regularUploadsDir, { recursive: true })

          const fileName = `payslip-${payroll.id}.pdf`
          fs.writeFileSync(path.join(publicUploadsDir, fileName), pdfBuffer)
          try { fs.writeFileSync(path.join(regularUploadsDir, fileName), pdfBuffer) } catch (_) {}

          const fileUrl = `/uploads/payslips/${fileName}`
          if (payroll.slipUrl !== fileUrl) {
            prisma.payroll.update({
              where: { id: payroll.id },
              data: { slipUrl: fileUrl },
            }).catch(() => {})
          }
        } catch (saveErr) {
          console.warn('Could not cache generated payslip PDF to disk:', saveErr)
        }
      }

      const fileName = `Payslip-${payroll.month}-${payroll.year}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      res.setHeader('Content-Length', pdfBuffer.length)
      return res.send(pdfBuffer)
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to download payslip', 500)
    }
  },

  // HR: Get all employees with salary details
  async getEmployeeSalaries(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)
      const data = await payrollService.getEmployeeSalaries(tenantId)
      return sendSuccess(res, data)
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to fetch salary data', 500)
    }
  },

  // HR: Generate payroll for a given month/year
  async generatePayroll(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)
      const { month, year } = req.body
      if (!month || !year) return sendError(res, 'Month and year are required', 400)
      const results = await payrollService.generatePayroll(tenantId, Number(month), Number(year))
      return sendSuccess(res, results, `Payroll generated for ${month}/${year} — ${results.length} records`)
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to generate payroll', 500)
    }
  },

  // HR: Get payroll records by month/year
  async getPayrollByMonthYear(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)
      const { month, year } = req.query
      if (!month || !year) return sendError(res, 'Month and year query params required', 400)
      const data = await payrollService.getPayrollByMonthYear(tenantId, Number(month), Number(year))
      return sendSuccess(res, data)
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to fetch payroll records', 500)
    }
  },

  // HR: Mark payroll as paid
  async markAsPaid(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)
      const { id } = req.params
      const updated = await payrollService.markAsPaid(tenantId, id)
      return sendSuccess(res, updated, 'Payroll marked as paid')
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update payroll', 500)
    }
  },

  // HR: Update employee salary/payroll details
  async updateEmployeeSalary(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)
      const { employeeId } = req.params
      const data = req.body
      const result = await payrollService.updateEmployeeSalary(tenantId, employeeId, data)
      return sendSuccess(res, result, 'Salary details updated successfully')
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update salary', 500)
    }
  },

  // HR: Manually upload salary slip PDF
  async uploadPayslip(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)

      const { employeeId, month, year, netSalary, autoDetect } = req.body
      if (!month || !year) {
        return sendError(res, 'Month and year are required', 400)
      }

      const isAutoDetect = (autoDetect === 'true' || autoDetect === true) && !employeeId

      if (!employeeId && !isAutoDetect) {
        return sendError(res, 'Please select an employee name or enable auto-detection', 400)
      }

      if (!req.file) {
        return sendError(res, 'Salary slip PDF file is required', 400)
      }

      let detectedEmployeeId = employeeId

      // Mirror file to public/uploads/payslips if directory exists so both static route and file download find it
      try {
        const publicUploadDir = path.join(process.cwd(), 'public', 'uploads', 'payslips')
        if (!fs.existsSync(publicUploadDir)) {
          fs.mkdirSync(publicUploadDir, { recursive: true })
        }
        const publicTarget = path.join(publicUploadDir, req.file.filename)
        if (!fs.existsSync(publicTarget)) {
          fs.copyFileSync(req.file.path, publicTarget)
        }
      } catch (copyErr) {
        console.warn('Could not mirror payslip to public folder:', copyErr)
      }

      if (isAutoDetect) {
        // Parse PDF to auto-detect employee
        const dataBuffer = fs.readFileSync(req.file.path)
        try {
          const pdfData = await pdfParse(dataBuffer)
          const text = pdfData.text

          // Get all active employees for this tenant
          const employees = await prisma.employee.findMany({
            where: { tenantId, status: 'ACTIVE' },
            select: { id: true, employeeCode: true, firstName: true, lastName: true },
          })

          const matches: any[] = []

          for (const emp of employees) {
            const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase()
            const code = emp.employeeCode.toLowerCase()
            
            // Check for exact employee code match first
            if (text.toLowerCase().includes(code)) {
              matches.push(emp)
            } else if (text.toLowerCase().includes(fullName)) {
              matches.push(emp)
            }
          }

          if (matches.length === 0) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
            return sendError(res, 'Could not auto-detect any employee from this salary slip. Please select the employee name manually.', 404)
          }

          if (matches.length > 1) {
            const codeMatches = matches.filter(emp => text.toLowerCase().includes(emp.employeeCode.toLowerCase()))
            if (codeMatches.length === 1) {
              detectedEmployeeId = codeMatches[0].id
            } else {
              if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
              return sendError(res, `Multiple employees matched (${matches.map(m => m.firstName + ' ' + m.lastName).join(', ')}). Please select the employee manually.`, 400)
            }
          } else {
            detectedEmployeeId = matches[0].id
          }
        } catch (parseError) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
          return sendError(res, 'Failed to read PDF document for auto-detection. Please select the employee name manually.', 400)
        }
      }

      // Non-blocking extraction of details if text parse is available
      try {
        const dataBuffer = fs.readFileSync(req.file.path)
        const pdfData = await pdfParse(dataBuffer)
        const text = pdfData.text
        const updates: any = {}

        const bankNameMatch = text.match(/(?:Bank Name|Bank)\s*:\s*([A-Za-z\s]+?)(?=\n|$|A\/c|Account)/i)
        if (bankNameMatch && bankNameMatch[1].trim()) updates.bankName = bankNameMatch[1].trim()

        const accMatch = text.match(/(?:A\/C No|Account No|Acc No|Account Number|A\/c Number)\s*[:.-]?\s*(\d{8,18})/i)
        if (accMatch) updates.accountNumber = accMatch[1].trim()

        const uanMatch = text.match(/(?:UAN|UAN No|UAN Number)\s*[:.-]?\s*(\d{12})/i)
        if (uanMatch) updates.uanNumber = uanMatch[1].trim()
        if (uanMatch) updates.pfEnabled = true

        const esiMatch = text.match(/(?:ESI No|ESIC No|ESI Number)\s*[:.-]?\s*(\d{10,17})/i)
        if (esiMatch) updates.esiEnabled = true

        const basicMatch = text.match(/(?:Basic|Basic Salary)\s*[:.-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)/i)
        let parsedBasic = 0
        if (basicMatch) {
          const val = parseFloat(basicMatch[1].replace(/,/g, ''))
          if (!isNaN(val) && val > 0) {
            parsedBasic = val
            updates.basicSalary = val
          }
        }

        const grossMatch = text.match(/(?:Gross|Gross Salary|Gross Earnings|Total Earnings|Total Payable)\s*[:.-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)/i)
        if (grossMatch) {
          const grossVal = parseFloat(grossMatch[1].replace(/,/g, ''))
          if (!isNaN(grossVal) && grossVal > 0) {
            updates.salaryGross = grossVal * 12
          }
        } else if (parsedBasic > 0) {
          updates.salaryGross = parsedBasic * 2 * 12
        }

        if (Object.keys(updates).length > 0 && detectedEmployeeId) {
          try {
            await payrollService.updateEmployeeSalary(tenantId, detectedEmployeeId, updates)
          } catch (updateErr) {
            console.log('Failed to auto-update extracted details:', updateErr)
          }
        }
      } catch (_) {
        // Non-fatal parse warning
      }

      const fileUrl = `/uploads/payslips/${req.file.filename}`

      const result = await payrollService.uploadPayslip({
        tenantId,
        employeeId: detectedEmployeeId,
        month: Number(month),
        year: Number(year),
        netSalary: netSalary ? Number(netSalary) : undefined,
        slipUrl: fileUrl,
      })

      return sendSuccess(res, result, 'Salary slip uploaded successfully and reflected on employee portal')
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to upload salary slip', 500)
    }
  },

  // HR: Generate single payslip directly from calculations and sync to employee portal
  async generateSinglePayslip(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)

      const { employeeId, month, year, netSalary, daysPaid, lossOfPay, deductions } = req.body
      if (!employeeId || !month || !year) {
        return sendError(res, 'employeeId, month, and year are required', 400)
      }

      const result = await payrollService.generateSinglePayslip({
        tenantId,
        employeeId,
        month: Number(month),
        year: Number(year),
        netSalary: netSalary !== undefined ? Number(netSalary) : undefined,
        daysPaid: daysPaid !== undefined ? Number(daysPaid) : undefined,
        lossOfPay: lossOfPay !== undefined ? Number(lossOfPay) : undefined,
        deductions: deductions !== undefined ? Number(deductions) : undefined,
      })

      return sendSuccess(res, result, 'Payslip generated and synced to employee portal successfully')
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to generate payslip', 500)
    }
  },

  // HR: Real-time attendance and leave analysis for monthly payroll calculation
  async getAttendanceAnalysis(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.tenantId ?? req.user?.tenantId
      if (!tenantId) return sendError(res, 'Tenant context not found', 400)

      const { employeeId, month, year } = req.query
      if (!employeeId || !month || !year) {
        return sendError(res, 'employeeId, month, and year query params are required', 400)
      }

      const analysis = await payrollService.getAttendanceAnalysis({
        tenantId,
        employeeId: String(employeeId),
        month: Number(month),
        year: Number(year),
      })

      return sendSuccess(res, analysis)
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to analyze attendance', 500)
    }
  },
}
