import { Router } from 'express'
import { employeeController } from '../controllers/employee.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Setup multer for documents
const uploadDir = path.join(process.cwd(), 'uploads', 'employees')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    cb(null, uploadDir)
  },
  filename: function (req: any, file: any, cb: any) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

const router = Router()

import { employeeRequestController } from '../controllers/employeeRequest.controller'

// Endpoint accessible to any authenticated user (like EMPLOYEE)
router.get('/me', authenticate, tenantIsolation, employeeController.getProfile)
router.put('/me/signature', authenticate, tenantIsolation, employeeController.uploadSignature)
router.put('/me/photo', authenticate, tenantIsolation, employeeController.uploadPhoto)
router.post('/me/documents', authenticate, tenantIsolation, upload.single('file'), employeeController.uploadDocumentSelf)

// Operations Requests
router.get('/requests', authenticate, tenantIsolation, employeeRequestController.listRequests)
router.post('/requests', authenticate, tenantIsolation, employeeRequestController.createRequest)
router.delete('/requests/:id', authenticate, tenantIsolation, employeeRequestController.deleteRequest)

router.use(authenticate, authorize('ADMIN', 'HR'), tenantIsolation)

router.get('/', employeeController.list)
router.post('/', employeeController.create)
router.get('/:id', employeeController.getById)
router.patch('/:id/status', employeeController.updateStatus)
router.put('/:id/shift', employeeController.updateShift)
router.put('/:id', upload.fields([
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 },
  { name: 'educationalCertificates', maxCount: 5 },
  { name: 'experienceLetters', maxCount: 5 },
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'previousPayslips', maxCount: 1 }
]), employeeController.update)
router.delete('/:id', employeeController.delete)

export default router

