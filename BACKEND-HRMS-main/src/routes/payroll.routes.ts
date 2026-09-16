import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

import { payrollController } from '../controllers/payroll.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

// Setup multer for payslips
const uploadDir = path.join(process.cwd(), 'uploads', 'payslips')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
const publicUploadDir = path.join(process.cwd(), 'public', 'uploads', 'payslips')
if (!fs.existsSync(publicUploadDir)) {
  fs.mkdirSync(publicUploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    cb(null, uploadDir)
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, 'manual-payslip-' + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

const router = Router()

// Base auth
router.use(authenticate, tenantIsolation)

// EMPLOYEE + HR + ADMIN: list payroll
router.get('/', authorize('ADMIN', 'HR', 'EMPLOYEE'), payrollController.list)

// EMPLOYEE + HR + ADMIN: download PDF payslip
router.get('/:id/download', authorize('ADMIN', 'HR', 'EMPLOYEE'), payrollController.downloadPayslip)

// HR-ONLY salary management routes
router.get('/salary/employees', authorize('HR', 'ADMIN'), payrollController.getEmployeeSalaries)
router.get('/salary/records', authorize('HR', 'ADMIN'), payrollController.getPayrollByMonthYear)
router.post('/salary/generate', authorize('HR', 'ADMIN'), payrollController.generatePayroll)
router.patch('/salary/:id/mark-paid', authorize('HR', 'ADMIN'), payrollController.markAsPaid)
router.put('/salary/employee/:employeeId', authorize('HR', 'ADMIN'), payrollController.updateEmployeeSalary)
router.post('/salary/upload', authorize('HR', 'ADMIN'), upload.single('payslip'), payrollController.uploadPayslip)

export default router
