import api from './axios'

export const payrollApi = {
  list: () => api.get('/payroll'),
  
  downloadPayslip: (id: string) => api.get(`/payroll/${id}/download`, { responseType: 'blob' }),

  // HR Salary Management
  getEmployeeSalaries: () => api.get('/payroll/salary/employees'),
  
  getPayrollRecords: (month: number, year: number) =>
    api.get('/payroll/salary/records', { params: { month, year } }),

  generatePayroll: (month: number, year: number) =>
    api.post('/payroll/salary/generate', { month, year }),

  markAsPaid: (payrollId: string) =>
    api.patch(`/payroll/salary/${payrollId}/mark-paid`),

  uploadPayslip: (formData: FormData) =>
    api.post('/payroll/salary/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  generateSinglePayslip: (data: {
    employeeId: string
    month: number
    year: number
    netSalary?: number
    daysPaid?: number
    lossOfPay?: number
    deductions?: number
  }) => api.post('/payroll/salary/generate-slip', data),

  getAttendanceAnalysis: (employeeId: string, month: number, year: number) =>
    api.get('/payroll/salary/attendance-analysis', { params: { employeeId, month, year } }),

  updateEmployeeSalary: (employeeId: string, data: {
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
  }) => api.put(`/payroll/salary/employee/${employeeId}`, data),

  // ── Salary Advance ─────────────────────────────────────────────────
  getAdvanceStats: () =>
    api.get('/salary-advances/stats'),

  listAdvances: (status?: string) =>
    api.get('/salary-advances', { params: status ? { status } : {} }),

  createAdvance: (data: {
    employeeId: string
    amount: number
    reason: string
    repaymentMonths: number
    notes?: string
  }) => api.post('/salary-advances', data),

  approveAdvance: (id: string) =>
    api.patch(`/salary-advances/${id}/approve`),

  rejectAdvance: (id: string, rejectionReason: string) =>
    api.patch(`/salary-advances/${id}/reject`, { rejectionReason }),

  disburseAdvance: (id: string) =>
    api.patch(`/salary-advances/${id}/disburse`),

  recordRepayment: (id: string, amount: number) =>
    api.patch(`/salary-advances/${id}/repayment`, { amount }),
}
