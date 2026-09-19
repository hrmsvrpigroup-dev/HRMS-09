import React, { useState, useEffect } from 'react'
import { FileText, Download, Eye, Sparkles, X, Landmark, Receipt, Calendar } from 'lucide-react'
import { payrollApi } from '../../api/payroll.api'

interface PayslipData {
  id: string
  month: number
  year: number
  basicSalary: number
  hra: number
  allowances: number
  deductions: number
  pf: number
  tax: number
  netSalary?: number
  status: 'DRAFT' | 'PROCESSED' | 'PAID'
  paidAt?: string
  slipUrl?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Payslips() {
  const [selectedSlip, setSelectedSlip] = useState<PayslipData | null>(null)
  const [payslips, setPayslips] = useState<PayslipData[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchPayslips = async () => {
      try {
        const res = await payrollApi.list()
        setPayslips(res.data.data || [])
      } catch (err) {
        console.error('Failed to fetch payslips', err)
      }
    }
    fetchPayslips()
  }, [])

  const calculateNetPay = (slip: PayslipData) => {
    if (slip.netSalary !== undefined && slip.netSalary !== null && Number(slip.netSalary) > 0) {
      return Number(slip.netSalary)
    }
    return (slip.basicSalary + slip.hra + slip.allowances) - (slip.pf + slip.tax)
  }

  const getSlipBreakdown = (slip: PayslipData) => {
    const netPay = calculateNetPay(slip)
    const totalDeductions = (slip.pf || 0) + (slip.tax || 0) + (slip.deductions ? Math.max(0, slip.deductions - (slip.pf || 0) - (slip.tax || 0)) : 0)
    let basic = slip.basicSalary || 0
    let hra = slip.hra || 0
    let allowances = slip.allowances || 0
    let gross = basic + hra + allowances

    if (gross === 0 && netPay > 0) {
      gross = netPay + totalDeductions
      basic = Math.round(gross * 0.5)
      hra = Math.round(gross * 0.3)
      allowances = Math.max(0, gross - basic - hra)
    }

    return { basic, hra, allowances, gross, totalDeductions, netPay }
  }

  const handleDownload = async (slip: PayslipData) => {
    setDownloadingId(slip.id)
    try {
      const response = await payrollApi.downloadPayslip(slip.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Payslip-${MONTHS[slip.month - 1]}-${slip.year}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (err: any) {
      console.error('Failed to download payslip', err)
      let errorMsg = 'Unable to download the payslip at this time. Please try again.'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const json = JSON.parse(text)
          if (json.message) errorMsg = json.message
        } catch (_) {}
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message
      }
      alert(errorMsg)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="payslips-page">
      <div className="payslips-header">
        <div className="header-title">
          <h1>My Payslips</h1>
          <p>Access, review, and download your monthly salary statements and taxation audits.</p>
        </div>
      </div>

      <div className="payslips-summary-banner">
        <div className="banner-icon"><Landmark size={24} /></div>
        <div className="banner-info">
          <h3>Direct Deposit Information</h3>
          <p>Your monthly payroll is directly transferred to your registered bank account on the last calendar day of the month.</p>
        </div>
      </div>

      {/* Payslips Grid Table */}
      <div className="table-card">
        <div className="table-header">
          <h3>Past Payslips</h3>
          <span className="results-count">{payslips.length} Statements</span>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Statement Month</th>
                <th>Total Earnings</th>
                <th>Total Deductions</th>
                <th>Net Paid Amount</th>
                <th>Credit Date</th>
                <th>Action Buttons</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip) => {
                const breakdown = getSlipBreakdown(slip)
                const isDownloading = downloadingId === slip.id
                return (
                  <tr key={slip.id}>
                    <td className="ref-cell">
                      <FileText size={16} className="text-gray-400" />
                      <strong>{slip.id}</strong>
                    </td>
                    <td className="month-cell">
                      <Calendar size={16} className="text-blue-500" />
                      <span>{MONTHS[slip.month - 1]} {slip.year}</span>
                    </td>
                    <td className="earnings-cell">₹{breakdown.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="deductions-cell">₹{breakdown.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="net-cell"><strong>₹{breakdown.netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                    <td className="date-cell">{slip.paidAt ? new Date(slip.paidAt).toLocaleDateString('en-IN') : '-'}</td>
                    <td>
                      <div className="btn-actions-row">
                        <button className="btn-table-action view" onClick={() => setSelectedSlip(slip)}>
                          <Eye size={14} />
                          <span>View Breakdown</span>
                        </button>
                        <button
                          className="btn-table-action download"
                          disabled={isDownloading}
                          onClick={() => handleDownload(slip)}
                        >
                          <Download size={14} className={isDownloading ? 'animate-bounce' : ''} />
                          <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Breakdown Modal */}
      {selectedSlip && (() => {
        const breakdown = getSlipBreakdown(selectedSlip)
        const isDownloading = downloadingId === selectedSlip.id
        return (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-area">
                <Receipt className="text-blue-500" size={20} />
                <h3>Payslip Breakdown — {MONTHS[selectedSlip.month - 1]} {selectedSlip.year}</h3>
              </div>
              <button className="close-btn" onClick={() => setSelectedSlip(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="modal-ref-strip">
                <span>Ref Code: {selectedSlip.id}</span>
                <span className="badge-success">{selectedSlip.status} ON {selectedSlip.paidAt ? new Date(selectedSlip.paidAt).toLocaleDateString('en-IN') : 'PENDING'}</span>
              </div>

              <div className="breakdown-grid">
                <div className="breakdown-column">
                  <h4>Earnings</h4>
                  <div className="item-row">
                    <span>Basic Salary</span>
                    <strong>₹{breakdown.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="item-row">
                    <span>House Rent Allowance (HRA)</span>
                    <strong>₹{breakdown.hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="item-row">
                    <span>Special Allowances</span>
                    <strong>₹{breakdown.allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="total-row">
                    <span>Gross Earnings</span>
                    <strong>₹{breakdown.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="breakdown-column">
                  <h4>Deductions</h4>
                  <div className="item-row">
                    <span>Provident Fund (PF)</span>
                    <strong className="text-red-500">-₹{selectedSlip.pf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="item-row">
                    <span>Professional Tax</span>
                    <strong className="text-red-500">-₹{selectedSlip.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="item-row">
                    <span>Tax Deducted at Source (TDS)</span>
                    <strong className="text-red-500">-₹0.00</strong>
                  </div>
                  <div className="total-row deductions">
                    <span>Total Deductions</span>
                    <strong className="text-red-500">-₹{breakdown.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              <div className="net-payable-block">
                <div className="net-label-col">
                  <strong>Net Payable Salary</strong>
                  <span>Transferred to Registered Bank Account</span>
                </div>
                <div className="net-amount">
                  ₹{breakdown.netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedSlip(null)}>Close</button>
              <button
                className="btn-primary"
                disabled={isDownloading}
                onClick={() => handleDownload(selectedSlip)}
              >
                <Download size={16} className={isDownloading ? 'animate-bounce' : ''} />
                <span>{isDownloading ? 'Downloading...' : 'Download Statement'}</span>
              </button>
            </div>
          </div>
        </div>
      )})()}

      <style>{`
        .payslips-page {
          padding: 24px 32px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .payslips-header { margin-bottom: 24px; }
        .payslips-header h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
        .payslips-header p { color: #64748b; font-size: 0.9rem; margin: 0; }

        .payslips-summary-banner {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .banner-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: white;
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(59,130,246,0.1);
          flex-shrink: 0;
        }

        .banner-info h3 { margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 800; color: #1e3a8a; }
        .banner-info p { margin: 0; font-size: 0.85rem; color: #1e40af; line-height: 1.5; }

        .table-card {
          background: white;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.01);
        }

        .table-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .table-header h3 { margin: 0; font-size: 1rem; font-weight: 800; color: #0f172a; }
        .results-count { font-size: 0.8rem; color: #64748b; font-weight: 500; }
        
        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background: #f8fafc; padding: 14px 24px; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
        td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; color: #334155; }
        tr:last-child td { border-bottom: none; }

        .ref-cell, .month-cell { display: flex; align-items: center; gap: 8px; }
        .ref-cell strong { color: #0f172a; }
        .month-cell span { font-weight: 600; color: #0f172a; }

        .earnings-cell, .deductions-cell, .net-cell { font-family: monospace; font-size: 0.95rem; }
        .net-cell { color: #10b981; }

        .btn-actions-row { display: flex; gap: 8px; }
        .btn-table-action {
          border: 1px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          background: white;
          transition: all 0.2s;
        }

        .btn-table-action.view { color: #3b82f6; }
        .btn-table-action.view:hover { background: #eff6ff; border-color: #3b82f6; }
        .btn-table-action.download { color: #64748b; }
        .btn-table-action.download:hover { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }

        /* Modal styling */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 650px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          overflow: hidden;
          animation: modalSlide 0.25s ease-out;
        }

        @keyframes modalSlide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title-area { display: flex; align-items: center; gap: 10px; }
        .modal-title-area h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #0f172a; }

        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { color: #0f172a; }

        .modal-body { padding: 24px; }
        
        .modal-ref-strip {
          background: #f8fafc;
          border-radius: 8px;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 20px;
        }

        .badge-success { background: #dcfce3; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; }

        .breakdown-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .breakdown-column h4 {
          margin: 0 0 12px 0;
          font-size: 0.9rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 8px;
        }

        .item-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: #334155;
          margin-bottom: 10px;
        }

        .item-row strong { font-family: monospace; font-size: 0.9rem; }
        .text-red-500 { color: #ef4444; }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
          margin-top: 12px;
          font-weight: 700;
          font-size: 0.88rem;
          color: #0f172a;
        }

        .total-row strong { font-family: monospace; font-size: 0.95rem; }

        .net-payable-block {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .net-label-col { display: flex; flex-direction: column; }
        .net-label-col strong { color: #14532d; font-size: 1rem; font-weight: 800; }
        .net-label-col span { color: #166534; font-size: 0.78rem; }

        .net-amount { font-size: 1.75rem; font-weight: 800; color: #166534; font-family: monospace; }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-outline {
          background: white; border: 1px solid #cbd5e1; color: #334155; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; cursor: pointer;
        }
        .btn-outline:hover { background: #f8fafc; }

        .btn-primary {
          background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;
        }
        .btn-primary:hover { background: #2563eb; }
      `}</style>
    </div>
  )
}
