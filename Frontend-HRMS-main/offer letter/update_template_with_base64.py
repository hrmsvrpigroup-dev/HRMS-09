import json
import re

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\parsed_14_pages.json', 'r', encoding='utf-8') as f:
    pages = json.load(f)

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\watermark_b64.txt', 'r') as f:
    watermark_b64 = f.read().strip()

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\logo_b64.txt', 'r') as f:
    logo_b64 = f.read().strip()

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\seal_b64.txt', 'r') as f:
    seal_b64 = f.read().strip()

print(f"Loaded {len(pages)} pages and base64 assets.")

def clean_page(p_num, html):
    h = html
    h = h.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    
    if p_num == 1:
        return """
          <div class="letterhead-header">
            <div class="company-brand">
              <div class="company-name">VR PI TECH SOLUTIONS LLP</div>
              <div class="company-sub">
                Head Quarters: 2-27-163, Gandhi Nagar, Near Jammi Chettu, Wanaparthy, Telangana, India - 509103.<br />
                Email: talentacquisition@vrpigroup.co.in | Phone: (+91) 879-094-6714 | Website: www.vrpigroup.co.in
              </div>
            </div>
            <img src="${VRPI_LOGO_DATA_URI}" class="company-logo" alt="VR PI Logo" />
          </div>

          <div class="meta-row">
            <div><strong>Ref. no.:</strong> ${d.referenceNo}</div>
            <div><strong>Date:</strong> ${d.offerDate}</div>
          </div>

          <div class="cand-salutation">
            <strong>${d.genderPrefix || 'Mr./Ms.'} ${d.candidateName}</strong>
          </div>

          <div class="subject-title">
            <u><strong>SUBJECT:</strong></u> You are appointed as <strong>${d.jobTitle}</strong> in <strong>VR PI TECH SOLUTIONS LLP</strong>.
          </div>

          <p>Dear <strong>${d.candidateName}</strong>,</p>
          <p class="congrats">Congratulations!!</p>

          <p class="text-justify">
            With reference to your application and the subsequent interview(s) you have had with us, we are pleased to confirm your appointment for the above position in the Organization subject to the following terms and conditions:
          </p>

          <div class="section-title"><u>JOB TITLE:</u></div>
          <p>You shall be designated as <strong>${d.jobTitle}</strong> in <strong>${d.department}</strong>.</p>

          <div class="section-title"><u>ANNUAL COMPENSATION:</u></div>
          <p class="text-justify">
            Your annual compensation including benefits and perquisites, if any, payable by the Organization will be <strong>INR ${b.annualCtc.toLocaleString('en-IN')}/- (${ctcWords})</strong>.
          </p>
          <p class="text-justify small-muted">
            Besides this, you will be eligible for Gratuity and leave encashment as per and subject to the conditions specified in payment of Gratuity Act, 1972 and other applicable acts. Your compensation will be subject to income tax as per the provisions of the Income Tax Act, 1961 which may vary from time to time.
          </p>

          <div class="section-title"><u>DATE OF JOINING:</u></div>
          <p>As agreed, you shall join the services of the organization on <strong>${d.joiningDate}</strong>.</p>

          <div class="section-title"><u>General Terms and Conditions of Employment:</u></div>
          <p class="text-justify">
            The following outlines the terms and conditions of employment between VR PI Tech Solutions LLP (hereinafter referred to as the "Company") and the undersigned employee (hereinafter referred to as the "Employee"). The Company reserves the right to reasonably modify, update or amend these terms and conditions as necessary, with due notice.
          </p>
"""
    elif p_num == 13:
        return """
          <div class="letterhead-header-small">
            <div class="company-name-small">VR PI TECH SOLUTIONS LLP</div>
            <img src="${VRPI_LOGO_DATA_URI}" class="company-logo-small" alt="VR PI Logo" />
          </div>

          <div class="section-title"><u>Rights to Injunctive Relief:</u></div>
          <p class="text-justify">
            You agree and acknowledge that any violation of the provisions of Confidentiality, Intellectual Property Rights, Non-Compete, Non-Solicitation, or Insubordination causes irreparable harm to the Company for which monetary damages alone would not be an adequate remedy. Accordingly, the Company shall be entitled to seek and obtain equitable relief, including temporary and permanent injunctions, specific performance, and any other remedies available at law or in equity, without the necessity of posting a bond.
          </p>

          <div class="section-title"><u>Governing Law and Arbitration:</u></div>
          <p class="text-justify">
            This Agreement shall be governed and construed by the laws of India and Courts situated at Hyderabad shall have exclusive jurisdiction. Any dispute, claim or controversy arising under or relating to this Employment terms/conditions of whatsoever nature the validity, interpretation, or breach thereof, shall be resolved through binding arbitration administered in Hyderabad under the Indian Arbitration and Conciliation Act, 1996 by a sole arbitrator appointed mutually by the parties.
          </p>

          <div class="section-title"><u>Medical Fitness:</u></div>
          <p class="text-justify">
            You declare that you are medically fit to carry out the duties expected of you by the Company. You represent that you do not have any contagious diseases or medical conditions that prevent the fulfillment of professional duties assigned to you.
          </p>

          <div class="section-title"><u>Separation &amp; Loan Settlements:</u></div>
          <p class="text-justify">
            Upon separation/termination of your employment, you shall repay all amounts given by the Company by way of loans, salary advances, training expenses, or asset damages, and the Company is entitled to adjust the same from your full and final settlement.
          </p>

          <p class="text-justify" style="margin-top: 1rem; font-weight: 600;">
            Please sign each page of the duplicate copy of this letter signifying your acceptance to all the above terms and conditions set out herein.
          </p>
          <p style="margin-top: 0.5rem; font-weight: 600;">
            We welcome you to the family and sincerely hope that your period of service with us will be long, pleasant and of mutual benefit.
          </p>

          <div class="signature-container">
            <div class="sig-box">
              <strong>For VR PI TECH SOLUTIONS LLP</strong><br /><br />
              <img src="${VRPI_SEAL_DATA_URI}" class="sig-seal" alt="Seal" />
              <div class="sig-line">________________________</div>
              <strong>Authorized Signatory &amp; Seal</strong>
            </div>
            <div class="sig-box">
              <strong>Candidate Acceptance:</strong><br /><br /><br />
              <div class="sig-line">________________________</div>
              <strong>Name: ${d.candidateName}</strong><br />
              <span>Date: ___________________</span>
            </div>
          </div>
"""
    elif p_num == 14:
        return """
          <div class="letterhead-header">
            <div class="company-brand">
              <div class="company-name">VR PI TECH SOLUTIONS LLP</div>
              <div class="company-sub">Annexure - Detailed Compensation &amp; Deductions Structure</div>
            </div>
            <img src="${VRPI_LOGO_DATA_URI}" class="company-logo" alt="VR PI Logo" />
          </div>

          <div class="annexure-title">Annexure</div>
          <p style="margin-bottom: 0.5rem; font-size: 0.8rem; color: #334155;">
            The gross salary of the employee for every month is as follows:
          </p>

          <div class="table-card">
            <table class="salary-table">
              <tbody>
                {/* 1. Header: GROSS SALARY CALCULATIONS (#00AF50) */}
                <tr class="table-row-green-header">
                  <td colspan="3">GROSS SALARY CALCULATIONS</td>
                </tr>

                {/* 2. Subheader: Particulars | Monthly | Yearly (#FFFF00) */}
                <tr class="table-row-yellow-sub">
                  <td style="width: 50%;">Particulars</td>
                  <td style="width: 25%; text-align: right;">Monthly</td>
                  <td style="width: 25%; text-align: right;">Yearly</td>
                </tr>

                {/* 3. Gross Row (#92D050) */}
                <tr class="table-row-lightgreen-gross">
                  <td>Gross</td>
                  <td style="text-align: right;">${b.monthlyGross.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.annualCtc.toLocaleString('en-IN')}</td>
                </tr>

                {/* 4. Earnings breakdown (white rows) */}
                <tr class="table-row-white">
                  <td>Basic</td>
                  <td style="text-align: right;">${b.basicMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.basicYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white">
                  <td>House Rent Allowance (HRA)</td>
                  <td style="text-align: right;">${b.hraMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.hraYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white">
                  <td>LTA</td>
                  <td style="text-align: right;">${b.ltaMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.ltaYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white">
                  <td>Insurance &amp; Other Allowance</td>
                  <td style="text-align: right;">${b.otherAllowMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.otherAllowYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white" style="font-weight: 700;">
                  <td>Total Amount (CTC)</td>
                  <td style="text-align: right;">${b.monthlyGross.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.annualCtc.toLocaleString('en-IN')}</td>
                </tr>

                {/* 5. Deductions Header (#00AF50) */}
                <tr class="table-row-green-header">
                  <td colspan="3">Deductions</td>
                </tr>

                {/* 6. Deductions breakdown (white rows) */}
                <tr class="table-row-white">
                  <td>Professional Tax</td>
                  <td style="text-align: right;">${b.ptMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.ptYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white">
                  <td>Provident Fund</td>
                  <td style="text-align: right;">${b.pfMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.pfYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white">
                  <td>Other Deductions</td>
                  <td style="text-align: right;">${b.otherDeductMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.otherDeductYearly.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="table-row-white" style="font-weight: 700;">
                  <td>Total Deductions</td>
                  <td style="text-align: right;">${b.totalDeductMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">${b.totalDeductYearly.toLocaleString('en-IN')}</td>
                </tr>

                {/* 7. Net Take-Home Row */}
                <tr class="table-row-net-takehome">
                  <td>Net Take-Home Salary (In-Hand)</td>
                  <td style="text-align: right;">₹${b.netMonthly.toLocaleString('en-IN')}</td>
                  <td style="text-align: right;">₹${b.netYearly.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="acceptance-box">
            <strong>Employee Acceptance Declaration:</strong><br />
            I accept the aforesaid terms &amp; conditions and this offer of employment. I shall keep the contents of this document confidential and agree to join on or before the agreed date.
          </div>

          <div class="signature-container" style="margin-top: 1rem;">
            <div class="sig-box">
              <strong>For VR PI TECH SOLUTIONS LLP</strong><br /><br />
              <img src="${VRPI_SEAL_DATA_URI}" class="sig-seal" alt="Seal" />
              <div class="sig-line">________________________</div>
              <strong>Authorized Signatory &amp; Seal</strong>
            </div>
            <div class="sig-box">
              <strong>Candidate Signature:</strong><br /><br /><br />
              <div class="sig-line">________________________</div>
              <strong>Name: ${d.candidateName}</strong><br />
              <span>Date: ___________________</span>
            </div>
          </div>

          <div class="footer-addresses">
            <div class="office-col">
              <strong>Head Quarters:</strong><br />
              2-27-163, Gandhi Nagar, Near Jammi Chettu, Wanaparthy, Telangana, India 509103.<br />
              Phone no.: (+91) 8790946714
            </div>
            <div class="office-col">
              <strong>INDIA (Hyderabad):</strong><br />
              Dwaraka Central, Plot no.: 57, 4th Floor, Hitech City Rd, VIP Hills, Jaihind Enclave, Madhapur, Hyderabad - 500081.<br />
              Phone no.: (+91) 8790946714
            </div>
            <div class="office-col">
              <strong>USA:</strong><br />
              5 Green-tree Centre, Dr 525, Route 73, STE 104, Burlington City, New Jersey 08053.<br />
              Phone no.: +1 646-741-8264
            </div>
          </div>
"""
    else:
        return f"""
          <div class="letterhead-header-small">
            <div class="company-name-small">VR PI TECH SOLUTIONS LLP</div>
            <img src="${{VRPI_LOGO_DATA_URI}}" class="company-logo-small" alt="VR PI Logo" />
          </div>
          <div class="page-body-content">
            {h}
          </div>
"""

ts_file_path = r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\src\utils\offerLetterTemplate.ts'

ts_lines = [
    "/* eslint-disable @typescript-eslint/no-explicit-any */",
    "// ═══════════════════════════════════════════════════════════════════════════════",
    "// OFFICIAL 14-PAGE FORMAL OFFER LETTER & EMPLOYMENT AGREEMENT TEMPLATE",
    "// VR PI TECH SOLUTIONS LLP (Exact DOCX layout, Background Watermark & Annexure)",
    "// ═══════════════════════════════════════════════════════════════════════════════",
    "",
    f"export const VRPI_WATERMARK_DATA_URI = '{watermark_b64}';",
    f"export const VRPI_LOGO_DATA_URI = '{logo_b64}';",
    f"export const VRPI_SEAL_DATA_URI = '{seal_b64}';",
    "",
    "export interface OfferLetterData {",
    "  candidateName: string;",
    "  jobTitle: string;",
    "  department: string;",
    "  annualCtc: number;",
    "  joiningDate: string;",
    "  referenceNo: string;",
    "  offerDate: string;",
    "  genderPrefix?: string;",
    "}",
    "",
    "export interface SalaryBreakdown {",
    "  annualCtc: number;",
    "  monthlyGross: number;",
    "  basicMonthly: number;",
    "  basicYearly: number;",
    "  hraMonthly: number;",
    "  hraYearly: number;",
    "  ltaMonthly: number;",
    "  ltaYearly: number;",
    "  otherAllowMonthly: number;",
    "  otherAllowYearly: number;",
    "  ptMonthly: number;",
    "  ptYearly: number;",
    "  pfMonthly: number;",
    "  pfYearly: number;",
    "  otherDeductMonthly: number;",
    "  otherDeductYearly: number;",
    "  totalDeductMonthly: number;",
    "  totalDeductYearly: number;",
    "  netMonthly: number;",
    "  netYearly: number;",
    "}",
    "",
    "export function calculateSalaryBreakdown(annualCtc: number): SalaryBreakdown {",
    "  const ctc = Math.round(Number(annualCtc) || 0);",
    "  const monthlyGross = Math.round(ctc / 12);",
    "  const basicMonthly = Math.round(monthlyGross * 0.50);",
    "  const basicYearly = basicMonthly * 12;",
    "  const hraMonthly = Math.round(monthlyGross * 0.25);",
    "  const hraYearly = hraMonthly * 12;",
    "  const ltaMonthly = Math.round(monthlyGross * 0.10);",
    "  const ltaYearly = ltaMonthly * 12;",
    "  const otherAllowMonthly = Math.max(0, monthlyGross - (basicMonthly + hraMonthly + ltaMonthly));",
    "  const otherAllowYearly = ctc - (basicYearly + hraYearly + ltaYearly);",
    "",
    "  const ptMonthly = 200;",
    "  const ptYearly = 2400;",
    "  const pfMonthly = 1800;",
    "  const pfYearly = 21600;",
    "  const otherDeductMonthly = 200;",
    "  const otherDeductYearly = 2400;",
    "  const totalDeductMonthly = ptMonthly + pfMonthly + otherDeductMonthly;",
    "  const totalDeductYearly = ptYearly + pfYearly + otherDeductYearly;",
    "",
    "  const netMonthly = Math.max(0, monthlyGross - totalDeductMonthly);",
    "  const netYearly = Math.max(0, ctc - totalDeductYearly);",
    "",
    "  return {",
    "    annualCtc: ctc,",
    "    monthlyGross,",
    "    basicMonthly,",
    "    basicYearly,",
    "    hraMonthly,",
    "    hraYearly,",
    "    ltaMonthly,",
    "    ltaYearly,",
    "    otherAllowMonthly,",
    "    otherAllowYearly,",
    "    ptMonthly,",
    "    ptYearly,",
    "    pfMonthly,",
    "    pfYearly,",
    "    otherDeductMonthly,",
    "    otherDeductYearly,",
    "    totalDeductMonthly,",
    "    totalDeductYearly,",
    "    netMonthly,",
    "    netYearly",
    "  };",
    "}",
    "",
    "export function numberToWordsINR(num: number): string {",
    "  if (!num || isNaN(num)) return 'Zero Rupees Only';",
    "  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];",
    "  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];",
    "",
    "  const n = ('000000000' + num).substr(-9).match(/^(\\\\d{2})(\\\\d{2})(\\\\d{2})(\\\\d{1})(\\\\d{2})$/);",
    "  if (!n) return '';",
    "  let str = '';",
    "  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';",
    "  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';",
    "  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';",
    "  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';",
    "  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Rupees Only' : 'Rupees Only';",
    "  return str.replace(/\\\\s+/g, ' ').trim();",
    "}",
    "",
    "export function getOfferLetterPageHtml(pageNum: number, d: OfferLetterData): string {",
    "  const b = calculateSalaryBreakdown(d.annualCtc);",
    "  const ctcWords = numberToWordsINR(b.annualCtc);",
    "  switch (pageNum) {"
]

for p in pages:
    idx = p['pageNumber']
    content = clean_page(idx, p['html'])
    content_escaped = content.replace('`', '\\`')
    ts_lines.append(f"    case {idx}:")
    ts_lines.append(f"      return `{content_escaped}`;")

ts_lines.extend([
    "    default:",
    "      return '';",
    "  }",
    "}",
    "",
    "export function getOfferLetterStyles(): string {",
    "  return `",
    "    * { box-sizing: border-box; margin: 0; padding: 0; }",
    "    body { font-family: 'Calibri', 'Arial', sans-serif; color: #000000; background: #cbd5e1; font-size: 13px; line-height: 1.5; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
    "    .offer-doc-container { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; }",
    "    .page-sheet { width: 210mm; min-height: 297mm; padding: 18mm 20mm 18mm 20mm; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.12); border-radius: 4px; position: relative; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; overflow: hidden; }",
    "    .watermark-bg { position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%); width: 78%; max-width: 540px; opacity: 0.24; pointer-events: none; z-index: 0; object-fit: contain; }",
    "    .page-content-wrapper { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }",
    "    .letterhead-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 16px; }",
    "    .letterhead-header-small { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #94a3b8; padding-bottom: 5px; margin-bottom: 14px; }",
    "    .company-name { font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; }",
    "    .company-name-small { font-size: 13px; font-weight: 700; color: #1e3a8a; }",
    "    .company-sub { font-size: 9.5px; color: #475569; margin-top: 3px; line-height: 1.35; }",
    "    .company-logo { height: 44px; width: auto; object-fit: contain; }",
    "    .company-logo-small { height: 26px; width: auto; object-fit: contain; }",
    "    .meta-row { display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 12px; font-size: 12.5px; }",
    "    .cand-salutation { margin: 8px 0 12px 0; font-size: 13.5px; font-weight: 700; }",
    "    .subject-title { font-weight: 700; margin: 10px 0 12px 0; font-size: 13px; }",
    "    .congrats { font-weight: 800; color: #16a34a; margin: 6px 0; font-size: 13.5px; }",
    "    .section-title { font-weight: 800; font-size: 12.5px; margin: 10px 0 3px 0; color: #000000; text-transform: uppercase; }",
    "    p { margin-bottom: 8px; text-align: justify; font-size: 12px; line-height: 1.48; }",
    "    .text-justify { text-align: justify; }",
    "    .small-muted { font-size: 11px; color: #475569; }",
    "    .table-card { border: 1.5px solid #000000; overflow: hidden; margin: 12px 0; }",
    "    .salary-table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: 'Calibri', 'Arial', sans-serif; }",
    "    .salary-table td, .salary-table th { border: 1px solid #000000; padding: 5px 8px; font-size: 12px; }",
    "    .table-row-green-header { background-color: #00AF50 !important; font-weight: 800; text-align: center; text-transform: uppercase; font-size: 13px; color: #ffffff !important; }",
    "    .table-row-green-header td { color: #ffffff !important; font-weight: 800; text-align: center; }",
    "    .table-row-yellow-sub { background-color: #FFFF00 !important; font-weight: 700; color: #000000 !important; }",
    "    .table-row-yellow-sub td { font-weight: 700; color: #000000 !important; }",
    "    .table-row-lightgreen-gross { background-color: #92D050 !important; font-weight: 700; color: #000000 !important; }",
    "    .table-row-lightgreen-gross td { font-weight: 700; color: #000000 !important; }",
    "    .table-row-white { background-color: #ffffff !important; color: #000000 !important; }",
    "    .table-row-net-takehome { background-color: #ecfdf5 !important; font-weight: 800; color: #065f46 !important; font-size: 12.5px; }",
    "    .annexure-title { text-align: center; font-weight: 800; text-decoration: underline; font-size: 15px; margin: 8px 0 4px 0; color: #000000; }",
    "    .acceptance-box { margin: 10px 0; font-size: 11px; border: 1px solid #000000; padding: 6px 8px; background: #ffffff; }",
    "    .signature-container { display: flex; justify-content: space-between; margin-top: 16px; font-size: 11.5px; }",
    "    .sig-box { width: 45%; }",
    "    .sig-seal { height: 42px; width: auto; display: block; margin-bottom: 4px; }",
    "    .sig-line { margin: 16px 0 3px 0; }",
    "    .page-footer-bar { position: relative; z-index: 1; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 5px; font-size: 10px; color: #64748b; margin-top: 10px; }",
    "    .footer-addresses { display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #000000; padding-top: 6px; margin-top: 12px; font-size: 9px; color: #475569; }",
    "    .office-col { flex: 1; line-height: 1.35; }",
    "    @media print {",
    "      body { background: #ffffff !important; padding: 0 !important; }",
    "      .offer-doc-container { padding: 0 !important; gap: 0 !important; }",
    "      .page-sheet { width: 100% !important; min-height: 100vh !important; height: 100vh !important; box-shadow: none !important; border-radius: 0 !important; padding: 15mm 15mm 15mm 15mm !important; margin: 0 !important; page-break-after: always !important; }",
    "      .watermark-bg { opacity: 0.24 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
    "      @page { size: A4 portrait; margin: 0; }",
    "      .no-print { display: none !important; }",
    "    }",
    "  `;",
    "}",
    "",
    "export function renderFormalOfferFullHtml(d: OfferLetterData): string {",
    "  let pagesHtml = '';",
    "  for (let i = 1; i <= 14; i++) {",
    "    const body = getOfferLetterPageHtml(i, d);",
    "    pagesHtml += `",
    "      <div class=\"page-sheet\" id=\"page-${i}\">",
    "        <img src=\"${VRPI_WATERMARK_DATA_URI}\" class=\"watermark-bg\" alt=\"VR PI Watermark\" />",
    "        <div class=\"page-content-wrapper\">",
    "          ${body}",
    "        </div>",
    "        <div class=\"page-footer-bar\">",
    "          <span>VR PI TECH SOLUTIONS LLP — STRICTLY CONFIDENTIAL</span>",
    "          <span>Page ${i} of 14</span>",
    "        </div>",
    "      </div>",
    "    `;",
    "  }",
    "",
    "  return `<!DOCTYPE html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\"/>",
    "  <title>Formal Offer Letter - ${d.candidateName} (14 Pages)</title>",
    "  <style>${getOfferLetterStyles()}</style>",
    "</head>",
    "<body>",
    "  <div class=\"offer-doc-container\">",
    "    ${pagesHtml}",
    "  </div>",
    "</body>",
    "</html>`;",
    "}",
    ""
])

with open(ts_file_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(ts_lines))

print(f"Successfully generated {ts_file_path} with embedded base64 watermark & logos!")
