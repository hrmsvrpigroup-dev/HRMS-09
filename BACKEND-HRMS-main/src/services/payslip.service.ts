import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { logoBase64 } from '../assets/logo.base64'

interface PayslipData {
  companyName: string
  companyLogoUrl?: string | null
  subdomain: string
  employeeCode: string
  employeeName: string
  designation: string
  location: string
  panNumber: string
  joiningDate: string
  bankName: string
  bankAccountNumber: string
  uanNumber: string
  pfNumber: string
  esicNumber: string
  daysPaid: number
  lossOfPay: number
  monthName: string
  year: number
  basic: number
  hra: number
  lta: number
  specialAllowance: number
  professionalTax: number
  pfDeduction: number
  otherDeductions: number
  netSalary: number
}

function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  };
  
  return convert(Math.floor(num));
}

export class PayslipService {
  static async generatePayslipPDF(data: PayslipData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 })
        const chunks: Buffer[] = []

        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        doc.font('Helvetica')

        // -------------------------
        // LOGO & HEADER
        // -------------------------
        let logoImage: any = null
        if (data.companyLogoUrl) {
          const logoPath = path.join(process.cwd(), data.companyLogoUrl)
          try {
            if (fs.existsSync(logoPath)) {
              logoImage = logoPath
            }
          } catch (e) {
            console.error('Failed to resolve custom company logo:', e)
          }
        }

        if (!logoImage) {
          logoImage = Buffer.from(logoBase64, 'base64')
        }

        // Render company logo at top right
        doc.image(logoImage, 415, 30, { width: 130 })

        // Payslip title
        const topY = 120
        doc.fontSize(14).fillColor('#0f172a').font('Helvetica-Bold')
        doc.text(`PAYSLIP FOR THE MONTH OF ${data.monthName.toUpperCase()}-${data.year}`, 50, topY)

        // -------------------------
        // EMPLOYEE INFORMATION TABLE (4 Columns)
        // -------------------------
        const infoTableTop = topY + 25
        const col1Left = 50
        const col2Left = 150
        const col3Left = 320
        const col4Left = 420
        const tableWidth = 495
        const rowH = 18

        const empRows = [
          { c1: 'Employee ID:', c2: data.employeeCode, c3: 'PAN No.', c4: data.panNumber || '-' },
          { c1: 'Name', c2: data.employeeName, c3: 'Days Paid', c4: String(data.daysPaid) },
          { c1: 'Designation', c2: data.designation, c3: 'Loss of Pay', c4: String(data.lossOfPay) },
          { c1: 'Base Location', c2: data.location || 'Hyderabad', c3: 'D.O.R', c4: '-' },
          { c1: 'D.O.J', c2: data.joiningDate, c3: 'Bank Name', c4: data.bankName || '-' },
          { c1: 'Bank A/C No', c2: data.bankAccountNumber || '-', c3: 'UAN', c4: data.uanNumber || '-' },
          { c1: 'PF Member ID', c2: data.pfNumber || '-', c3: 'ESIC IP Number', c4: data.esicNumber || '-' }
        ]

        doc.lineWidth(1).strokeColor('#000000')

        // Draw external border of the grid
        doc.rect(col1Left, infoTableTop, tableWidth, rowH * empRows.length).stroke()

        empRows.forEach((row, idx) => {
          const currentY = infoTableTop + (idx * rowH)

          // Draw horizontal lines between rows (except last row bottom which has outer border)
          if (idx < empRows.length - 1) {
            doc.moveTo(col1Left, currentY + rowH).lineTo(col1Left + tableWidth, currentY + rowH).stroke()
          }

          // Draw internal vertical lines
          doc.moveTo(col2Left - 5, currentY).lineTo(col2Left - 5, currentY + rowH).stroke()
          doc.moveTo(col3Left - 5, currentY).lineTo(col3Left - 5, currentY + rowH).stroke()
          doc.moveTo(col4Left - 5, currentY).lineTo(col4Left - 5, currentY + rowH).stroke()

          doc.fontSize(8).fillColor('#0f172a')

          // Column 1 key
          doc.font('Helvetica-Bold').text(row.c1, col1Left + 5, currentY + 5, { width: col2Left - col1Left - 10, lineBreak: false })
          // Column 2 value
          doc.font('Helvetica').text(row.c2, col2Left, currentY + 5, { width: col3Left - col2Left - 10, lineBreak: false })
          // Column 3 key
          doc.font('Helvetica-Bold').text(row.c3, col3Left, currentY + 5, { width: col4Left - col3Left - 10, lineBreak: false })
          // Column 4 value
          doc.font('Helvetica').text(row.c4, col4Left, currentY + 5, { width: col1Left + tableWidth - col4Left - 5, lineBreak: false })
        })

        // -------------------------
        // EARNINGS & DEDUCTIONS TABLE
        // -------------------------
        const calcTableTop = infoTableTop + (empRows.length * rowH) + 20
        const calcColWidth = 145
        const amtColWidth = 102.5

        const earnColLeft = 50
        const earnAmtColLeft = earnColLeft + calcColWidth
        const dedColLeft = earnAmtColLeft + amtColWidth
        const dedAmtColLeft = dedColLeft + calcColWidth

        const formatAmt = (val: number) => val > 0 ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'

        const salaryRows = [
          { earn: 'Basic', earnAmt: data.basic, ded: 'Professional Tax', dedAmt: data.professionalTax },
          { earn: 'HRA', earnAmt: data.hra, ded: 'Tax', dedAmt: 0 },
          { earn: 'LTA', earnAmt: data.lta, ded: 'NPS', dedAmt: 0 },
          { earn: 'Conveyance', earnAmt: 0, ded: 'Provident Fund', dedAmt: 0 },
          { earn: 'Medical', earnAmt: 0, ded: 'EPF', dedAmt: data.pfDeduction },
          { earn: 'Special Allowance', earnAmt: data.specialAllowance, ded: 'Others', dedAmt: data.otherDeductions }
        ]

        const totalEarnings = data.basic + data.hra + data.lta + data.specialAllowance
        const totalDeductions = data.professionalTax + data.pfDeduction + data.otherDeductions

        // Header Row
        doc.rect(earnColLeft, calcTableTop, tableWidth, rowH).fillColor('#dbeafe').fill()
        doc.rect(earnColLeft, calcTableTop, tableWidth, rowH).strokeColor('#000000').stroke()

        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold')
        doc.text('Earnings', earnColLeft + 5, calcTableTop + 5)
        doc.text('Current Month', earnAmtColLeft + 5, calcTableTop + 5, { width: amtColWidth - 10, align: 'right' })
        doc.text('Deductions', dedColLeft + 5, calcTableTop + 5)
        doc.text('Current Month', dedAmtColLeft + 5, calcTableTop + 5, { width: amtColWidth - 10, align: 'right' })

        // Data Rows
        doc.rect(earnColLeft, calcTableTop + rowH, tableWidth, rowH * salaryRows.length).stroke()

        salaryRows.forEach((row, idx) => {
          const currentY = calcTableTop + rowH + (idx * rowH)

          // Inter row lines
          if (idx < salaryRows.length - 1) {
            doc.moveTo(earnColLeft, currentY + rowH).lineTo(earnColLeft + tableWidth, currentY + rowH).stroke()
          }

          // Vertical lines
          doc.moveTo(earnAmtColLeft - 5, currentY).lineTo(earnAmtColLeft - 5, currentY + rowH).stroke()
          doc.moveTo(dedColLeft - 5, currentY).lineTo(dedColLeft - 5, currentY + rowH).stroke()
          doc.moveTo(dedAmtColLeft - 5, currentY).lineTo(dedAmtColLeft - 5, currentY + rowH).stroke()

          doc.fontSize(8).fillColor('#0f172a').font('Helvetica')
          doc.text(row.earn, earnColLeft + 5, currentY + 5)
          doc.text(formatAmt(row.earnAmt), earnAmtColLeft + 5, currentY + 5, { width: amtColWidth - 10, align: 'right' })
          doc.text(row.ded, dedColLeft + 5, currentY + 5)
          doc.text(formatAmt(row.dedAmt), dedAmtColLeft + 5, currentY + 5, { width: amtColWidth - 10, align: 'right' })
        })

        // Totals Row
        const totalsY = calcTableTop + rowH + (salaryRows.length * rowH)
        doc.rect(earnColLeft, totalsY, tableWidth, rowH).stroke()
        doc.moveTo(earnAmtColLeft - 5, totalsY).lineTo(earnAmtColLeft - 5, totalsY + rowH).stroke()
        doc.moveTo(dedColLeft - 5, totalsY).lineTo(dedColLeft - 5, totalsY + rowH).stroke()
        doc.moveTo(dedAmtColLeft - 5, totalsY).lineTo(dedAmtColLeft - 5, totalsY + rowH).stroke()

        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold')
        doc.text('Total', earnColLeft + 5, totalsY + 5)
        doc.text(formatAmt(totalEarnings), earnAmtColLeft + 5, totalsY + 5, { width: amtColWidth - 10, align: 'right' })
        doc.text('Total', dedColLeft + 5, totalsY + 5)
        doc.text(formatAmt(totalDeductions), dedAmtColLeft + 5, totalsY + 5, { width: amtColWidth - 10, align: 'right' })

        // Net Pay Row
        const netPayY = totalsY + rowH
        doc.rect(earnColLeft, netPayY, tableWidth, rowH).stroke()
        doc.moveTo(earnAmtColLeft - 5, netPayY).lineTo(earnAmtColLeft - 5, netPayY + rowH).stroke()

        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold')
        doc.text('Net Pay', earnColLeft + 5, netPayY + 5)
        doc.text(formatAmt(data.netSalary), earnAmtColLeft + 5, netPayY + 5, { width: amtColWidth - 10, align: 'right' })

        // Net pay in words description
        const words = numberToWords(data.netSalary)
        const descY = netPayY + rowH + 12
        doc.fontSize(8).fillColor('#0f172a').font('Helvetica')
        doc.text(
          `Net Pay of Rs. ${data.netSalary.toLocaleString('en-IN')}/- (Rupees ${words} only) Credited into your bank account.`,
          earnColLeft,
          descY,
          { width: tableWidth }
        )

        // Note line
        const noteY = descY + 28
        doc.fontSize(8).fillColor('#475569').font('Helvetica')
        doc.text('Note: This is system generated pay-slip does not required any seal and signature.', earnColLeft, noteY)

        // -------------------------
        // FOOTER ADDRESS
        // -------------------------
        const footerY = 700
        doc.moveTo(earnColLeft, footerY).lineTo(earnColLeft + tableWidth, footerY).strokeColor('#e2e8f0').lineWidth(1).stroke()

        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold')
        doc.text('VR PI TECH SOLUTIONS LLP', earnColLeft, footerY + 12, { align: 'center', width: tableWidth })
        
        doc.fontSize(7.5).fillColor('#475569').font('Helvetica')
        doc.text(
          'Dwaraka Central, Plot no.: 57, 4th Floor, Hitech City Rd, Madhapur, Hyderabad, Telangana - 500081.',
          earnColLeft,
          footerY + 26,
          { align: 'center', width: tableWidth }
        )
        doc.text(
          'Email: info@vrpigroup.co.in ; Phone: +918790946714.',
          earnColLeft,
          footerY + 38,
          { align: 'center', width: tableWidth }
        )

        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }
}
