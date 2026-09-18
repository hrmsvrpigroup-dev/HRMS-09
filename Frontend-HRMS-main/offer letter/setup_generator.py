import json
import re

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\parsed_14_pages.json', 'r', encoding='utf-8') as f:
    pages = json.load(f)

print(f'Total pages loaded: {len(pages)}')

# Let's inspect placeholders in each page
# In page 1:
# Candidate name, designation, department, ctc, joining date, date, ref no.
# In page 13:
# Signatures
# In page 14:
# Salary calculations table, acceptance declaration, signatures, office addresses.

# Let's write generator script
with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\generate_ts_template.py', 'w', encoding='utf-8') as f:
    f.write('''# Generator for offerLetterTemplate.ts
import json
import re

with open(r'c:\\Users\\shiva\\OneDrive\\Desktop\\hrms-lastest\\Frontend-HRMS-main\\offer letter\\parsed_14_pages.json', 'r', encoding='utf-8') as f:
    pages = json.load(f)

def clean_html(html, page_num):
    # Fix smart quotes, apostrophes, weird characters
    h = html.replace('', "'").replace('&rsquo;', "'").replace('&lsquo;', "'").replace('&ldquo;', '"').replace('&rdquo;', '"')
    return h

ts_code = """// ═══════════════════════════════════════════════════════════════════════════════
// OFFICIAL 14-PAGE FORMAL OFFER LETTER & EMPLOYMENT AGREEMENT TEMPLATE
// VR PI TECH SOLUTIONS LLP
// ═══════════════════════════════════════════════════════════════════════════════

export interface OfferLetterData {
  candidateName: string;
  jobTitle: string;
  department: string;
  annualCtc: number;
  joiningDate: string;
  referenceNo: string;
  offerDate: string;
  genderPrefix?: string; // Mr. / Ms.
}

export interface SalaryBreakdown {
  annualCtc: number;
  monthlyGross: number;
  basicMonthly: number;
  basicYearly: number;
  hraMonthly: number;
  hraYearly: number;
  ltaMonthly: number;
  ltaYearly: number;
  otherAllowMonthly: number;
  otherAllowYearly: number;
  ptMonthly: number;
  ptYearly: number;
  pfMonthly: number;
  pfYearly: number;
  otherDeductMonthly: number;
  otherDeductYearly: number;
  totalDeductMonthly: number;
  totalDeductYearly: number;
  netMonthly: number;
  netYearly: number;
}

export function calculateSalaryBreakdown(annualCtc: number): SalaryBreakdown {
  const ctc = Math.round(Number(annualCtc) || 0);
  const monthlyGross = Math.round(ctc / 12);
  const basicMonthly = Math.round(monthlyGross * 0.50);
  const basicYearly = basicMonthly * 12;
  const hraMonthly = Math.round(monthlyGross * 0.25);
  const hraYearly = hraMonthly * 12;
  const ltaMonthly = Math.round(monthlyGross * 0.10);
  const ltaYearly = ltaMonthly * 12;
  const otherAllowMonthly = Math.max(0, monthlyGross - (basicMonthly + hraMonthly + ltaMonthly));
  const otherAllowYearly = ctc - (basicYearly + hraYearly + ltaYearly);

  const ptMonthly = 200;
  const ptYearly = 2400;
  const pfMonthly = 1800;
  const pfYearly = 21600;
  const otherDeductMonthly = 200;
  const otherDeductYearly = 2400;
  const totalDeductMonthly = ptMonthly + pfMonthly + otherDeductMonthly;
  const totalDeductYearly = ptYearly + pfYearly + otherDeductYearly;

  const netMonthly = Math.max(0, monthlyGross - totalDeductMonthly);
  const netYearly = Math.max(0, ctc - totalDeductYearly);

  return {
    annualCtc: ctc,
    monthlyGross,
    basicMonthly,
    basicYearly,
    hraMonthly,
    hraYearly,
    ltaMonthly,
    ltaYearly,
    otherAllowMonthly,
    otherAllowYearly,
    ptMonthly,
    ptYearly,
    pfMonthly,
    pfYearly,
    otherDeductMonthly,
    otherDeductYearly,
    totalDeductMonthly,
    totalDeductYearly,
    netMonthly,
    netYearly
  };
}

export function numberToWordsINR(num: number): string {
  if (!num || isNaN(num)) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Rupees Only' : 'Rupees Only';
  return str.replace(/\\s+/g, ' ').trim();
}
"""

print('Writing page template functions...')
''')

print('Generator script written.')
