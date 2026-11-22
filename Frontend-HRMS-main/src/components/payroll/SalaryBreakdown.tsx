import React, { useState, useEffect, useMemo } from 'react'
import { formatINR, numberToWordsINR, cleanYearly } from '../../utils/offerLetterTemplate'

const round2 = (n: number | string | null | undefined): number => {
  return Math.round((Number(n) || 0) * 100) / 100
}

export interface SalaryBreakdownProps {
  annualSalary?: number | string
  monthlySalary?: number | string
  onSalaryChange?: (annual: number, monthly: number, epfMonthly: number) => void
  readOnly?: boolean
}

export default function SalaryBreakdown({
  annualSalary = 0,
  monthlySalary = 0,
  onSalaryChange,
  readOnly = false,
}: SalaryBreakdownProps) {
  const [withGross, setWithGross] = useState<boolean>(false)
  const [isEditingBreakdown, setIsEditingBreakdown] = useState<boolean>(false)

  // Parse parent salary input
  const parentAnnual = cleanYearly(Number(annualSalary) || 0)
  const parentMonthly = round2(Number(monthlySalary) || (parentAnnual > 0 ? parentAnnual / 12 : 0))

  // Internal salary base
  const [currentCtcYearly, setCurrentCtcYearly] = useState<number>(parentAnnual)

  // Custom user breakdown overrides
  const [customBreakdown, setCustomBreakdown] = useState<{
    basicMonthly?: number
    basicYearly?: number
    hraMonthly?: number
    hraYearly?: number
    ltaMonthly?: number
    ltaYearly?: number
    epfMonthly?: number
    epfYearly?: number
    insuranceMonthly?: number
    insuranceYearly?: number
    grossMonthly?: number
    grossYearly?: number
    ptMonthly?: number
    ptYearly?: number
    deductInsuranceMonthly?: number
    deductInsuranceYearly?: number
    otherDeductMonthly?: number
    otherDeductYearly?: number
  }>({})

  // Synchronize when parent annual salary changes from input
  useEffect(() => {
    const cleanParent = cleanYearly(Number(annualSalary) || 0)
    if (cleanParent !== currentCtcYearly && cleanParent > 0) {
      setCurrentCtcYearly(cleanParent)
      // Reset custom overrides when parent sets a new salary base
      setCustomBreakdown({})
    }
  }, [annualSalary])

  // Compute breakdown components
  const breakdown = useMemo(() => {
    const ctc = cleanYearly(currentCtcYearly || 0)
    const monthlyGross = round2(ctc / 12)

    // Standard 50/18/10/12/10 formula
    const stdBasicYearly = cleanYearly(ctc * 0.50)
    const stdBasicMonthly = round2(stdBasicYearly / 12)
    const stdHraYearly = cleanYearly(ctc * 0.18)
    const stdHraMonthly = round2(stdHraYearly / 12)
    const stdLtaYearly = cleanYearly(ctc * 0.10)
    const stdLtaMonthly = round2(stdLtaYearly / 12)
    const stdEpfYearly = cleanYearly(ctc * 0.12)
    const stdEpfMonthly = round2(stdEpfYearly / 12)
    const stdInsuranceYearly = cleanYearly(ctc * 0.10)
    const stdInsuranceMonthly = round2(stdInsuranceYearly / 12)

    const basicMonthly = customBreakdown.basicMonthly !== undefined ? round2(customBreakdown.basicMonthly) : stdBasicMonthly
    const basicYearly = customBreakdown.basicYearly !== undefined ? cleanYearly(customBreakdown.basicYearly) : stdBasicYearly
    const hraMonthly = customBreakdown.hraMonthly !== undefined ? round2(customBreakdown.hraMonthly) : stdHraMonthly
    const hraYearly = customBreakdown.hraYearly !== undefined ? cleanYearly(customBreakdown.hraYearly) : stdHraYearly
    const ltaMonthly = customBreakdown.ltaMonthly !== undefined ? round2(customBreakdown.ltaMonthly) : stdLtaMonthly
    const ltaYearly = customBreakdown.ltaYearly !== undefined ? cleanYearly(customBreakdown.ltaYearly) : stdLtaYearly
    const epfMonthly = customBreakdown.epfMonthly !== undefined ? round2(customBreakdown.epfMonthly) : stdEpfMonthly
    const epfYearly = customBreakdown.epfYearly !== undefined ? cleanYearly(customBreakdown.epfYearly) : stdEpfYearly
    const insuranceMonthly = customBreakdown.insuranceMonthly !== undefined ? round2(customBreakdown.insuranceMonthly) : stdInsuranceMonthly
    const insuranceYearly = customBreakdown.insuranceYearly !== undefined ? cleanYearly(customBreakdown.insuranceYearly) : stdInsuranceYearly

    const ctcMonthly = monthlyGross
    const ctcYearly = ctc

    const grossMonthly = customBreakdown.grossMonthly !== undefined ? round2(customBreakdown.grossMonthly) : (basicMonthly * 2)
    const grossYearly = customBreakdown.grossYearly !== undefined ? cleanYearly(customBreakdown.grossYearly) : (basicYearly * 2)

    // Deductions
    const ptMonthly = customBreakdown.ptMonthly !== undefined ? round2(customBreakdown.ptMonthly) : 200
    const ptYearly = customBreakdown.ptYearly !== undefined ? cleanYearly(customBreakdown.ptYearly) : 2400
    const deductEpfMonthly = epfMonthly
    const deductEpfYearly = epfYearly
    const deductInsuranceMonthly = customBreakdown.deductInsuranceMonthly !== undefined ? round2(customBreakdown.deductInsuranceMonthly) : insuranceMonthly
    const deductInsuranceYearly = customBreakdown.deductInsuranceYearly !== undefined ? cleanYearly(customBreakdown.deductInsuranceYearly) : insuranceYearly
    const otherDeductMonthly = customBreakdown.otherDeductMonthly !== undefined ? round2(customBreakdown.otherDeductMonthly) : 200
    const otherDeductYearly = customBreakdown.otherDeductYearly !== undefined ? cleanYearly(customBreakdown.otherDeductYearly) : 2400

    const totalDeductMonthly = round2(ptMonthly + deductEpfMonthly + deductInsuranceMonthly + otherDeductMonthly)
    const totalDeductYearly = cleanYearly(ptYearly + deductEpfYearly + deductInsuranceYearly + otherDeductYearly)

    // Net take-home calculation
    const baseForNetMonthly = withGross ? grossMonthly : basicMonthly
    const baseForNetYearly = withGross ? grossYearly : basicYearly

    const netMonthly = round2(Math.max(0, baseForNetMonthly - totalDeductMonthly))
    const netYearly = cleanYearly(Math.max(0, baseForNetYearly - totalDeductYearly))

    return {
      ctcMonthly,
      ctcYearly,
      grossMonthly,
      grossYearly,
      basicMonthly,
      basicYearly,
      hraMonthly,
      hraYearly,
      ltaMonthly,
      ltaYearly,
      epfMonthly,
      epfYearly,
      insuranceMonthly,
      insuranceYearly,
      ptMonthly,
      ptYearly,
      deductEpfMonthly,
      deductEpfYearly,
      deductInsuranceMonthly,
      deductInsuranceYearly,
      otherDeductMonthly,
      otherDeductYearly,
      totalDeductMonthly,
      totalDeductYearly,
      netMonthly,
      netYearly,
    }
  }, [currentCtcYearly, customBreakdown, withGross])

  // Notify parent of synced salary values
  const handleNotifyParent = (newAnnual: number, newMonthly: number, newEpf: number) => {
    if (onSalaryChange) {
      onSalaryChange(newAnnual, newMonthly, newEpf)
    }
  }

  const handleAutoCalculate = (annual: number) => {
    const cleanAnnual = cleanYearly(annual)
    setCurrentCtcYearly(cleanAnnual)
    setCustomBreakdown({})
    const newMonthly = round2(cleanAnnual / 12)
    const newEpf = round2((cleanAnnual * 0.12) / 12)
    handleNotifyParent(cleanAnnual, newMonthly, newEpf)
  }

  const updateCustom = (fields: Partial<typeof customBreakdown>) => {
    setCustomBreakdown(prev => {
      const next = { ...prev, ...fields }
      return next
    })
  }

  return (
    <div style={{ marginTop: '24px', fontFamily: 'Arial, sans-serif' }}>
      {/* ── Table Header Bar & Controls (Matches Image 2) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            SALARY PARTICULARS &amp; STATUTORY DEDUCTIONS
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isEditingBreakdown ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: withGross ? '#f0fdf4' : '#f8fafc',
                color: withGross ? '#166534' : '#64748b',
                border: withGross ? '1px solid #bbf7d0' : '1px solid #cbd5e1'
              }}>
                {withGross ? 'With Gross' : 'Without Gross'}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setIsEditingBreakdown(true)}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✏️ Edit Breakdown
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* With Gross / Without Gross Switch */}
              <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px', border: '1px solid #cbd5e1' }}>
                <button
                  type="button"
                  onClick={() => setWithGross(true)}
                  style={{
                    padding: '3px 9px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: withGross ? '#2563eb' : 'transparent',
                    color: withGross ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Include Gross row in calculations"
                >
                  {withGross && '✓ '}With Gross
                </button>
                <button
                  type="button"
                  onClick={() => setWithGross(false)}
                  style={{
                    padding: '3px 9px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: !withGross ? '#2563eb' : 'transparent',
                    color: !withGross ? '#ffffff' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Exclude Gross row from table"
                >
                  {!withGross && '✓ '}Without Gross
                </button>
              </div>

              {/* Reset to 50/18/10/12/10 */}
              <button
                type="button"
                onClick={() => handleAutoCalculate(currentCtcYearly || parentAnnual || 420000)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Auto-calculate all breakdown factors (50/18/10/12/10)"
              >
                ↺ Auto-Calculate (50/18/10/12/10)
              </button>

              {/* Insurance Deduction Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (breakdown.deductInsuranceMonthly > 0 || breakdown.deductInsuranceYearly > 0) {
                    updateCustom({ deductInsuranceMonthly: 0, deductInsuranceYearly: 0 })
                  } else {
                    const defaultYearly = cleanYearly(breakdown.ctcYearly * 0.10)
                    const defaultMonthly = round2(defaultYearly / 12)
                    updateCustom({ deductInsuranceMonthly: defaultMonthly, deductInsuranceYearly: defaultYearly })
                  }
                }}
                style={{
                  background: (breakdown.deductInsuranceMonthly > 0 || breakdown.deductInsuranceYearly > 0) ? '#fef2f2' : '#f0fdf4',
                  border: (breakdown.deductInsuranceMonthly > 0 || breakdown.deductInsuranceYearly > 0) ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  color: (breakdown.deductInsuranceMonthly > 0 || breakdown.deductInsuranceYearly > 0) ? '#dc2626' : '#16a34a',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title={(breakdown.deductInsuranceMonthly > 0 || breakdown.deductInsuranceYearly > 0) ? "Delete Insurance deduction (adds money to Take-Home)" : "Add 10% Insurance deduction"}
              >
                {(breakdown.deductInsuranceMonthly > 0 || breakdown.deductInsuranceYearly > 0) ? '🗑️ Delete Insurance' : '+ Add Insurance (10%)'}
              </button>

              <button
                type="button"
                onClick={() => setIsEditingBreakdown(false)}
                style={{
                  background: '#16a34a',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ✓ Done Editing
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Exact Reference Table (Gross Salary Calculations & Deductions) ── */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1.5px solid #000000', marginBottom: '14px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
        <colgroup>
          <col style={{ width: '50%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#d1e7dd', color: '#0f172a', textAlign: 'center', fontWeight: 'bold' }}>
            <th colSpan={3} style={{ padding: '8px 12px', fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', border: '1.5px solid #000000', boxSizing: 'border-box' }}>
              GROSS SALARY CALCULATIONS
            </th>
          </tr>
          <tr style={{ background: '#f8fafc', color: '#000000', fontWeight: 'bold', fontSize: '0.78rem' }}>
            <th style={{ padding: '6px 12px', textAlign: 'left', border: '1px solid #000000', width: '50%', boxSizing: 'border-box' }}>Particulars</th>
            <th style={{ padding: '6px 12px', textAlign: 'right', border: '1px solid #000000', width: '25%', boxSizing: 'border-box' }}>Monthly</th>
            <th style={{ padding: '6px 12px', textAlign: 'right', border: '1px solid #000000', width: '25%', boxSizing: 'border-box' }}>Yearly</th>
          </tr>
        </thead>
        <tbody style={{ fontSize: '0.78rem' }}>
          {/* Gross Primary Row (only rendered when withGross is true) */}
          {withGross && (
            <tr style={{ background: '#9bd770', fontWeight: 'bold' }}>
              <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Gross</td>
              <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
                {isEditingBreakdown ? (
                  <input
                    type="number"
                    step="0.01"
                    value={breakdown.grossMonthly}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0
                      updateCustom({ grossMonthly: val, grossYearly: cleanYearly(val * 12) })
                    }}
                    style={{ width: '100px', textAlign: 'right', padding: '2px 4px', fontWeight: 'bold', border: '1px solid #16a34a', borderRadius: '3px', fontSize: '0.78rem' }}
                  />
                ) : (
                  formatINR(breakdown.grossMonthly)
                )}
              </td>
              <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
                {isEditingBreakdown ? (
                  <input
                    type="number"
                    step="0.01"
                    value={breakdown.grossYearly}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0
                      updateCustom({ grossYearly: val, grossMonthly: round2(val / 12) })
                    }}
                    style={{ width: '100px', textAlign: 'right', padding: '2px 4px', fontWeight: 'bold', border: '1px solid #16a34a', borderRadius: '3px', fontSize: '0.78rem' }}
                  />
                ) : (
                  formatINR(breakdown.grossYearly)
                )}
              </td>
            </tr>
          )}

          {/* Basic */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Basic</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.basicMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ basicMonthly: val, basicYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.basicMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.basicYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ basicYearly: val, basicMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.basicYearly)
              )}
            </td>
          </tr>

          {/* House Rent Allowance (HRA) */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>House Rent Allowance (HRA)</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.hraMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ hraMonthly: val, hraYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.hraMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.hraYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ hraYearly: val, hraMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.hraYearly)
              )}
            </td>
          </tr>

          {/* LTA */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>LTA</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.ltaMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ ltaMonthly: val, ltaYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.ltaMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.ltaYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ ltaYearly: val, ltaMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.ltaYearly)
              )}
            </td>
          </tr>

          {/* EPF */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>EPF</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.epfMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ epfMonthly: val, epfYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.epfMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.epfYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ epfYearly: val, epfMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.epfYearly)
              )}
            </td>
          </tr>

          {/* Insurance */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Insurance</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.insuranceMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ insuranceMonthly: val, insuranceYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.insuranceMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.insuranceYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ insuranceYearly: val, insuranceMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.insuranceYearly)
              )}
            </td>
          </tr>

          {/* Total Amount (CTC) */}
          <tr style={{ fontWeight: 'bold', background: !withGross ? '#f0fdf4' : 'transparent' }}>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Total Amount (CTC)</td>
            <td style={{ padding: '6px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown && !withGross ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.ctcMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    handleAutoCalculate(val * 12)
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', fontWeight: 'bold', border: '1px solid #16a34a', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.ctcMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown && !withGross ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.ctcYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    handleAutoCalculate(val)
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', fontWeight: 'bold', border: '1px solid #16a34a', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.ctcYearly)
              )}
            </td>
          </tr>

          {/* ── Section 2: DEDUCTIONS (Matches Image 2) ── */}
          <tr style={{ background: '#009a49', color: '#ffffff', textAlign: 'center', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ padding: '8px 12px', fontSize: '0.85rem', letterSpacing: '0.5px', textTransform: 'uppercase', border: '1.5px solid #000000' }}>
              DEDUCTIONS
            </td>
          </tr>

          {/* Professional Tax */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Professional Tax</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.ptMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ ptMonthly: val, ptYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.ptMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.ptYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ ptYearly: val, ptMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.ptYearly)
              )}
            </td>
          </tr>

          {/* EPF */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>EPF</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.deductEpfMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ epfMonthly: val, epfYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.deductEpfMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.deductEpfYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ epfYearly: val, epfMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.deductEpfYearly)
              )}
            </td>
          </tr>

          {/* Insurance */}
          <tr style={{ background: (breakdown.deductInsuranceMonthly === 0 && breakdown.deductInsuranceYearly === 0) ? '#fefce8' : 'transparent' }}>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  Insurance
                  {(breakdown.deductInsuranceMonthly === 0 && breakdown.deductInsuranceYearly === 0) && (
                    <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: '#16a34a', fontWeight: 700 }}>
                      (+₹ added to Take-Home)
                    </span>
                  )}
                </span>
              </div>
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.deductInsuranceMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ deductInsuranceMonthly: val, deductInsuranceYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.deductInsuranceMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.deductInsuranceYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ deductInsuranceYearly: val, deductInsuranceMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.deductInsuranceYearly)
              )}
            </td>
          </tr>

          {/* Other Deductions */}
          <tr>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Other Deductions</td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.otherDeductMonthly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ otherDeductMonthly: val, otherDeductYearly: cleanYearly(val * 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.otherDeductMonthly)
              )}
            </td>
            <td style={{ padding: '4px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {isEditingBreakdown ? (
                <input
                  type="number"
                  step="0.01"
                  value={breakdown.otherDeductYearly}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    updateCustom({ otherDeductYearly: val, otherDeductMonthly: round2(val / 12) })
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '2px 4px', border: '1px solid #fca5a5', borderRadius: '3px', fontSize: '0.78rem' }}
                />
              ) : (
                formatINR(breakdown.otherDeductYearly)
              )}
            </td>
          </tr>

          {/* Total Deductions */}
          <tr style={{ fontWeight: 'bold' }}>
            <td style={{ padding: '6px 12px', border: '1px solid #000000' }}>Total Deductions</td>
            <td style={{ padding: '6px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {formatINR(breakdown.totalDeductMonthly)}
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'right', border: '1px solid #000000' }}>
              {formatINR(breakdown.totalDeductYearly)}
            </td>
          </tr>

          {/* Net Take-Home Salary (In-Hand) */}
          <tr style={{ background: '#e0f2fe', fontWeight: 'bold', fontSize: '0.85rem' }}>
            <td style={{ padding: '8px 12px', border: '1.5px solid #000000', color: '#0f172a' }}>
              Net Take-Home Salary (In-Hand)
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', border: '1.5px solid #000000', color: '#0f172a' }}>
              ₹{formatINR(breakdown.netMonthly)}
            </td>
            <td style={{ padding: '8px 12px', textAlign: 'right', border: '1.5px solid #000000', color: '#0f172a' }}>
              ₹{formatINR(breakdown.netYearly)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Net Disbursed Salary for the Month Card (Matches Image 2) ── */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        border: '1.5px solid #86efac',
        borderRadius: '8px',
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            NET DISBURSED SALARY FOR THE MONTH
          </div>
          <div style={{ fontSize: '0.78rem', color: '#15803d', fontStyle: 'italic', marginTop: '3px' }}>
            ({numberToWordsINR(breakdown.netMonthly)})
          </div>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#14532d' }}>
          ₹{formatINR(breakdown.netMonthly)}
        </div>
      </div>
    </div>
  )
}
