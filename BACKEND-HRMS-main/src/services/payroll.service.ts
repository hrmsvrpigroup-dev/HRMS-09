import { prisma } from '../config/database'
import fs from 'fs'
import path from 'path'
import { PayslipService } from './payslip.service'

export const payrollService = {
  async listByTenant(tenantId: string) {
    return prisma.payroll.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 50,
    })
  },

  // HR: Get all employees with their salary/payroll details
  async getEmployeeSalaries(tenantId: string) {
    return prisma.employee.findMany({
      where: { tenantId, status: { not: 'INACTIVE' } },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        salaryGross: true,
        employmentType: true,
        joiningDate: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
        payrollDetails: {
          select: {
            salaryStructure: true,
            basicSalary: true,
            paymentType: true,
            bankName: true,
            accountNumber: true,
            ifscCode: true,
            panNumber: true,
            uanNumber: true,
            pfEnabled: true,
            esiEnabled: true,
          },
        },
        payroll: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 1,
          select: {
            month: true,
            year: true,
            basicSalary: true,
            hra: true,
            allowances: true,
            deductions: true,
            pf: true,
            tax: true,
            netSalary: true,
            status: true,
            paidAt: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    })
  },

  // HR: Generate payroll for a specific month/year
  async generatePayroll(tenantId: string, month: number, year: number) {
    const employees = await prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { payrollDetails: true },
    })

    const results = []
    for (const emp of employees) {
      const monthlyCTC = (emp.salaryGross || 0) / 12
      const basic = monthlyCTC * 0.5
      const hra = basic * 0.5
      
      // Prevent negative Special Allowance by capping LTA at remaining balance
      const lta = Math.min(3000, Math.max(0, monthlyCTC - basic - hra))
      
      const pfEnabled = emp.payrollDetails?.pfEnabled ?? false
      const employerPf = pfEnabled ? Math.min(1800, Math.max(0, (monthlyCTC - hra) * 0.12)) : 0
      
      const specialAllowance = Math.max(0, monthlyCTC - basic - hra - lta - employerPf)
      const allowances = lta + specialAllowance
      
      const pfDeduction = pfEnabled ? Math.min(1800, basic * 0.12) : 0
      const tax = monthlyCTC > 0 ? 200 : 0
      const deductions = pfDeduction + tax
      const netSalary = Math.max(0, (basic + hra + allowances) - deductions)

      const record = await prisma.payroll.upsert({
        where: {
          tenantId_employeeId_month_year: {
            tenantId,
            employeeId: emp.id,
            month,
            year,
          },
        },
        update: {
          basicSalary: basic,
          hra,
          allowances,
          deductions,
          pf: pfDeduction,
          tax,
          netSalary,
          status: 'PROCESSED',
        },
        create: {
          tenantId,
          employeeId: emp.id,
          month,
          year,
          basicSalary: basic,
          hra,
          allowances,
          deductions,
          pf: pfDeduction,
          tax,
          netSalary,
          status: 'PROCESSED',
        },
      })
      results.push(record)
    }
    return results
  },

  // HR: Get payroll history for a specific month/year
  async getPayrollByMonthYear(tenantId: string, month: number, year: number) {
    return prisma.payroll.findMany({
      where: { tenantId, month, year },
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
      orderBy: { employee: { firstName: 'asc' } },
    })
  },

  // HR: Update payroll status to PAID and generate payslip PDF
  async markAsPaid(tenantId: string, payrollId: string) {
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId, tenantId },
      include: {
        employee: {
          include: {
            payrollDetails: true,
            department: true,
            designation: true,
            tenant: true,
            addressInfo: true,
          }
        }
      }
    })

    if (!payroll) {
      throw new Error('Payroll record not found')
    }

    const emp = payroll.employee
    const tenant = emp.tenant
    const details = emp.payrollDetails
    
    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const totalDays = new Date(payroll.year, payroll.month, 0).getDate()

    const payslipData = {
      companyName: tenant.name,
      companyLogoUrl: tenant.logoUrl,
      subdomain: tenant.subdomain,
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
      monthName: MONTHS[payroll.month - 1],
      year: payroll.year,
      basic: payroll.basicSalary,
      hra: payroll.hra,
      lta: Math.min(3000, payroll.allowances),
      specialAllowance: Math.max(0, payroll.allowances - Math.min(3000, payroll.allowances)),
      professionalTax: payroll.tax,
      pfDeduction: payroll.pf,
      otherDeductions: Math.max(0, payroll.deductions - payroll.pf - payroll.tax),
      netSalary: payroll.netSalary
    }

    const pdfBuffer = await PayslipService.generatePayslipPDF(payslipData)
    
    // Ensure payslip directory exists in public uploads
    const publicUploadsDir = path.join(__dirname, '../../public/uploads/payslips')
    if (!fs.existsSync(publicUploadsDir)) {
      fs.mkdirSync(publicUploadsDir, { recursive: true })
    }

    const fileName = `payslip-${payrollId}.pdf`
    const localFilePath = path.join(publicUploadsDir, fileName)
    fs.writeFileSync(localFilePath, pdfBuffer)

    const fileUrl = `/uploads/payslips/${fileName}`

    return prisma.payroll.update({
      where: { id: payrollId, tenantId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        slipUrl: fileUrl,
      },
    })
  },

  // HR: Update employee salary details
  async updateEmployeeSalary(tenantId: string, employeeId: string, data: {
    salaryGross?: number
    salaryStructure?: string
    basicSalary?: number
    paymentType?: string
    bankName?: string
    accountNumber?: string
    ifscCode?: string
    panNumber?: string
    uanNumber?: string
    pfEnabled?: boolean
    esiEnabled?: boolean
  }) {
    // Verify employee belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    })
    if (!employee) throw new Error('Employee not found')

    // Update main salary gross on employee record
    if (data.salaryGross !== undefined) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { salaryGross: data.salaryGross },
      })
    }

    // Upsert payroll details
    const { salaryGross, ...payrollDetailsData } = data
    return prisma.employeePayrollDetails.upsert({
      where: { employeeId },
      update: payrollDetailsData,
      create: { employeeId, ...payrollDetailsData },
    })
  },

  // HR: Manually upload salary slip PDF & sync to employee portal
  async uploadPayslip(params: {
    tenantId: string
    employeeId: string
    month: number
    year: number
    netSalary?: number
    slipUrl: string
  }) {
    const { tenantId, employeeId, month, year, netSalary, slipUrl } = params

    // Fetch employee details to calculate standard details if record doesn't exist
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: { payrollDetails: true }
    })
    if (!emp) throw new Error('Employee not found')

    const monthlyCTC = (emp.salaryGross || 0) / 12
    const basic = monthlyCTC * 0.5
    const hra = basic * 0.5
    const lta = Math.min(3000, Math.max(0, monthlyCTC - basic - hra))
    const pfEnabled = emp.payrollDetails?.pfEnabled ?? false
    const employerPf = pfEnabled ? Math.min(1800, Math.max(0, (monthlyCTC - hra) * 0.12)) : 0
    const specialAllowance = Math.max(0, monthlyCTC - basic - hra - lta - employerPf)
    const allowances = lta + specialAllowance
    const pfDeduction = pfEnabled ? Math.min(1800, basic * 0.12) : 0
    const tax = monthlyCTC > 0 ? 200 : 0
    const deductions = pfDeduction + tax
    const calculatedNetSalary = Math.max(0, (basic + hra + allowances) - deductions)

    const finalNetSalary = netSalary !== undefined ? netSalary : calculatedNetSalary

    // Create or update payroll record setting it as PAID
    const payroll = await prisma.payroll.upsert({
      where: {
        tenantId_employeeId_month_year: {
          tenantId,
          employeeId,
          month,
          year,
        },
      },
      update: {
        netSalary: finalNetSalary,
        status: 'PAID',
        paidAt: new Date(),
        slipUrl,
      },
      create: {
        tenantId,
        employeeId,
        month,
        year,
        basicSalary: basic,
        hra,
        allowances,
        deductions,
        pf: pfDeduction,
        tax,
        netSalary: finalNetSalary,
        status: 'PAID',
        paidAt: new Date(),
        slipUrl,
      },
    })

    // Send email notification to employee
    try {
      const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      const subject = `Payslip Available for ${MONTHS[month - 1]} ${year}`
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Payslip Available</h2>
          <p>Hello <strong>${emp.firstName} ${emp.lastName}</strong>,</p>
          <p>Your payslip for <strong>${MONTHS[month - 1]} ${year}</strong> has been uploaded by HR and is now available in your portal.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Period:</strong> ${MONTHS[month - 1]} ${year}</p>
            <p style="margin: 0 0 10px 0;"><strong>Net Pay:</strong> ₹${finalNetSalary.toLocaleString('en-IN')}</p>
            <p style="margin: 0 0 10px 0;"><strong>Portal URL:</strong> <a href="https://hrmsvrpigroup.com/employee/payslips">View in Portal</a></p>
          </div>
  
          <p>You can view, print, or download this payslip at any time from the "Payslips" section in your employee dashboard.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 0.8em; color: #94a3b8; text-align: center;">Thank you,<br>HRMS Operations Team</p>
        </div>
      `
      
      const { notificationService } = require('./notification.service')
      await notificationService.sendEmail(emp.email, subject, htmlBody)
      console.log(`Payslip email notification sent to ${emp.email}`)
    } catch (e) {
      console.error('Failed to send email notification:', e)
    }

    return payroll
  },

  // HR: Generate single payslip directly using attendance/payroll calculations & sync to employee portal
  async generateSinglePayslip(params: {
    tenantId: string
    employeeId: string
    month: number
    year: number
    netSalary?: number
    daysPaid?: number
    lossOfPay?: number
    deductions?: number
  }) {
    const { tenantId, employeeId, month, year, netSalary, daysPaid, lossOfPay, deductions: customDeductions } = params

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        payrollDetails: true,
        department: true,
        designation: true,
        tenant: true,
        addressInfo: true,
      }
    })
    if (!emp) throw new Error('Employee not found')

    const totalDays = new Date(year, month, 0).getDate()
    let monthlyCTC = (emp.salaryGross || 0) / 12
    const pfDeduction = 2000
    const professionalTax = 200
    const totalDeductions = customDeductions !== undefined ? customDeductions : (pfDeduction + professionalTax)

    if (monthlyCTC <= 0 && netSalary !== undefined && netSalary > 0) {
      monthlyCTC = netSalary + totalDeductions
    }

    const basic = Math.round(monthlyCTC * 0.5)
    const hra = Math.round(monthlyCTC * 0.3)
    const lta = Math.min(3000, Math.max(0, Math.round(monthlyCTC - basic - hra)))
    const specialAllowance = Math.max(0, Math.round(monthlyCTC - basic - hra - lta))
    const allowances = lta + specialAllowance

    const calculatedNet = Math.max(0, monthlyCTC - totalDeductions)
    const finalNetSalary = netSalary !== undefined ? netSalary : calculatedNet

    // Upsert payroll record
    const payroll = await prisma.payroll.upsert({
      where: {
        tenantId_employeeId_month_year: {
          tenantId,
          employeeId,
          month,
          year,
        },
      },
      update: {
        basicSalary: basic,
        hra,
        allowances,
        deductions: totalDeductions,
        pf: pfDeduction,
        tax: professionalTax,
        netSalary: finalNetSalary,
        status: 'PAID',
        paidAt: new Date(),
      },
      create: {
        tenantId,
        employeeId,
        month,
        year,
        basicSalary: basic,
        hra,
        allowances,
        deductions: totalDeductions,
        pf: pfDeduction,
        tax: professionalTax,
        netSalary: finalNetSalary,
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const payslipData = {
      companyName: emp.tenant.name,
      companyLogoUrl: emp.tenant.logoUrl,
      subdomain: emp.tenant.subdomain,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      designation: emp.designation?.title || 'Employee',
      location: emp.addressInfo?.city || 'Hyderabad',
      panNumber: emp.payrollDetails?.panNumber || '',
      joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
      bankName: emp.payrollDetails?.bankName || '',
      bankAccountNumber: emp.payrollDetails?.accountNumber || '',
      uanNumber: emp.payrollDetails?.uanNumber || '',
      pfNumber: emp.payrollDetails?.uanNumber ? 'PF-' + emp.payrollDetails.uanNumber : '-',
      esicNumber: emp.payrollDetails?.esiEnabled ? 'ESIC-' + emp.employeeCode : '-',
      daysPaid: daysPaid !== undefined ? daysPaid : totalDays,
      lossOfPay: lossOfPay !== undefined ? lossOfPay : 0,
      monthName: MONTHS[month - 1],
      year,
      basic,
      hra,
      lta,
      specialAllowance,
      professionalTax,
      pfDeduction,
      otherDeductions: Math.max(0, totalDeductions - pfDeduction - professionalTax),
      netSalary: finalNetSalary
    }

    try {
      const pdfBuffer = await PayslipService.generatePayslipPDF(payslipData)
      
      const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'payslips')
      if (!fs.existsSync(publicUploadsDir)) {
        fs.mkdirSync(publicUploadsDir, { recursive: true })
      }
      const regularUploadsDir = path.join(process.cwd(), 'uploads', 'payslips')
      if (!fs.existsSync(regularUploadsDir)) {
        fs.mkdirSync(regularUploadsDir, { recursive: true })
      }

      const fileName = `payslip-${payroll.id}.pdf`
      const publicFilePath = path.join(publicUploadsDir, fileName)
      const regularFilePath = path.join(regularUploadsDir, fileName)
      fs.writeFileSync(publicFilePath, pdfBuffer)
      try { fs.writeFileSync(regularFilePath, pdfBuffer) } catch (_) {}

      const fileUrl = `/uploads/payslips/${fileName}`

      await prisma.payroll.update({
        where: { id: payroll.id },
        data: { slipUrl: fileUrl },
      })
      payroll.slipUrl = fileUrl
    } catch (pdfErr) {
      console.error('Failed to generate PDF for single payslip:', pdfErr)
    }

    // Send email notification to employee
    try {
      const subject = `Payslip Available for ${MONTHS[month - 1]} ${year}`
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Payslip Available</h2>
          <p>Hello <strong>${emp.firstName} ${emp.lastName}</strong>,</p>
          <p>Your payslip for <strong>${MONTHS[month - 1]} ${year}</strong> has been generated and is now available in your portal.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Period:</strong> ${MONTHS[month - 1]} ${year}</p>
            <p style="margin: 0 0 10px 0;"><strong>Net Pay:</strong> ₹${finalNetSalary.toLocaleString('en-IN')}</p>
            <p style="margin: 0 0 10px 0;"><strong>Portal URL:</strong> <a href="https://hrmsvrpigroup.com/employee/payslips">View in Portal</a></p>
          </div>
          <p>You can view, print, or download this payslip at any time from the "Payslips" section in your employee dashboard.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 0.8em; color: #94a3b8; text-align: center;">Thank you,<br>HRMS Operations Team</p>
        </div>
      `
      const { notificationService } = require('./notification.service')
      await notificationService.sendEmail(emp.email, subject, htmlBody)
    } catch (e) {
      console.error('Failed to send email notification:', e)
    }

    return payroll
  },

  // HR: Get real-time monthly attendance analysis combining Attendance & Leave tables with Case 1 & Case 2 rules
  async getAttendanceAnalysis(params: {
    tenantId: string
    employeeId: string
    month: number
    year: number
  }) {
    const { tenantId, employeeId, month, year } = params

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        department: true,
        designation: true,
        payrollDetails: true,
      },
    })
    if (!emp) throw new Error('Employee not found')

    const daysInMonth = new Date(year, month, 0).getDate()
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999))

    const [attendanceList, leaveList] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          tenantId,
          employeeId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.leave.findMany({
        where: {
          tenantId,
          employeeId,
          status: 'APPROVED',
          fromDate: { lte: endDate },
          toDate: { gte: startDate },
        },
      }),
    ])

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()
    const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth)
    const isCurrentMonth = year === currentYear && month === currentMonth

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dailyBreakdown: any[] = []

    let totalWorkingDays = 0
    let presentWorkingDays = 0
    let onLeaveWorkingDays = 0
    let fridayLeaveDays = 0
    let mondayLeaveDays = 0
    let weekendPaidDays = 0
    let unpaidAbsenceDays = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d)
      const dayOfWeek = dateObj.getDay()
      const dayName = dayNames[dayOfWeek]
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isPastDate = isPastMonth || (isCurrentMonth && d <= currentDay)

      const hasApprovedLeave = leaveList.find(l => {
        const from = l.fromDate.toISOString().split('T')[0]
        const to = l.toDate.toISOString().split('T')[0]
        return dateStr >= from && dateStr <= to
      })

      const attRec = attendanceList.find(a => {
        const aDate = a.date.toISOString().split('T')[0]
        return aDate === dateStr
      })

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendPaidDays++
        dailyBreakdown.push({
          day: d,
          dateStr,
          dayName,
          dayOfWeek,
          status: 'WEEKEND_PAID',
          label: dayOfWeek === 6 ? 'Saturday (Paid Off)' : 'Sunday (Paid Off)',
          isPaid: true,
          isWorkingDay: false,
          caseApplied: 'WEEKEND_PAID',
        })
      } else {
        totalWorkingDays++

        if (dayOfWeek === 5) {
          // Friday
          if (attRec && attRec.status === 'PRESENT') {
            presentWorkingDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'PRESENT',
              label: 'Present',
              isPaid: true,
              isWorkingDay: true,
            })
          } else if (hasApprovedLeave || (attRec && (attRec.status === 'ON_LEAVE' || attRec.status === 'ABSENT')) || (isPastDate && !attRec)) {
            // Case 1: Friday Leave -> Sat & Sun are Paid Holidays
            onLeaveWorkingDays++
            fridayLeaveDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'LEAVE_FRIDAY',
              label: 'Friday Leave (Case 1: Sat/Sun Paid)',
              isPaid: true,
              isWorkingDay: true,
              caseApplied: 'CASE_1',
            })
          } else {
            // Future weekday in current month
            presentWorkingDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'PRESENT',
              label: 'Scheduled Working Day',
              isPaid: true,
              isWorkingDay: true,
            })
          }
        } else if (dayOfWeek === 1) {
          // Monday
          if (attRec && attRec.status === 'PRESENT') {
            presentWorkingDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'PRESENT',
              label: 'Present',
              isPaid: true,
              isWorkingDay: true,
            })
          } else if (hasApprovedLeave || (attRec && (attRec.status === 'ON_LEAVE' || attRec.status === 'ABSENT')) || (isPastDate && !attRec)) {
            // Case 2: Monday Leave -> Sat, Sun & Mon are Paid Leave
            onLeaveWorkingDays++
            mondayLeaveDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'LEAVE_MONDAY',
              label: 'Monday Paid Leave (Case 2: Sat/Sun/Mon Paid)',
              isPaid: true,
              isWorkingDay: true,
              caseApplied: 'CASE_2',
            })
          } else {
            presentWorkingDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'PRESENT',
              label: 'Scheduled Working Day',
              isPaid: true,
              isWorkingDay: true,
            })
          }
        } else {
          // Tue, Wed, Thu
          if (attRec && attRec.status === 'PRESENT') {
            presentWorkingDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'PRESENT',
              label: 'Present',
              isPaid: true,
              isWorkingDay: true,
            })
          } else if (hasApprovedLeave) {
            onLeaveWorkingDays++
            const isPaidLeave = hasApprovedLeave.type !== 'UNPAID'
            if (!isPaidLeave) unpaidAbsenceDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: isPaidLeave ? 'PAID_LEAVE' : 'UNPAID_ABSENT',
              label: `Approved ${hasApprovedLeave.type} Leave`,
              isPaid: isPaidLeave,
              isWorkingDay: true,
            })
          } else if (attRec && attRec.status === 'HALF_DAY') {
            presentWorkingDays += 0.5
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'HALF_DAY',
              label: 'Half Day (0.5 Present)',
              isPaid: true,
              isWorkingDay: true,
            })
          } else if (isPastDate && (!attRec || attRec.status === 'ABSENT')) {
            unpaidAbsenceDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'UNPAID_ABSENT',
              label: 'Absent / Unpaid Leave (LOP)',
              isPaid: false,
              isWorkingDay: true,
            })
          } else {
            presentWorkingDays++
            dailyBreakdown.push({
              day: d,
              dateStr,
              dayName,
              dayOfWeek,
              status: 'PRESENT',
              label: 'Scheduled Working Day',
              isPaid: true,
              isWorkingDay: true,
            })
          }
        }
      }
    }

    const paidWorkingDays = presentWorkingDays + onLeaveWorkingDays
    const payableDays = Math.max(0, daysInMonth - unpaidAbsenceDays)
    const monthlyGross = Math.round((emp.salaryGross || 0) / 12)
    const perDayIncomeByWorkingDays = totalWorkingDays > 0 ? Math.round((monthlyGross / totalWorkingDays) * 100) / 100 : 0
    const perDayIncomeByCalendarDays = daysInMonth > 0 ? Math.round((monthlyGross / daysInMonth) * 100) / 100 : 0
    const standardDeductions = 2200
    const lopDeduction = Math.round(unpaidAbsenceDays * perDayIncomeByWorkingDays)
    const totalDeductions = standardDeductions + lopDeduction
    const netSalaryByWorkingDays = Math.max(0, Math.round((paidWorkingDays * perDayIncomeByWorkingDays) - standardDeductions))
    const netSalaryByCalendarDays = Math.max(0, Math.round((payableDays * perDayIncomeByCalendarDays) - standardDeductions))

    return {
      employee: {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeCode: emp.employeeCode,
        salaryGross: emp.salaryGross,
        monthlyGross,
        department: emp.department?.name || '',
        designation: emp.designation?.title || '',
      },
      month,
      year,
      daysInMonth,
      totalWorkingDays,
      presentWorkingDays,
      onLeaveWorkingDays,
      fridayLeaveDays,
      mondayLeaveDays,
      weekendPaidDays,
      unpaidAbsenceDays,
      paidWorkingDays,
      payableDays,
      grossSalary: monthlyGross,
      perDayIncomeByWorkingDays,
      perDayIncomeByCalendarDays,
      standardDeductions,
      totalDeductions,
      netSalaryByWorkingDays,
      netSalaryByCalendarDays,
      dailyBreakdown,
    }
  },
}
