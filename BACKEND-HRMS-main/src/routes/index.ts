import { Router } from 'express'

import adminRoutes from './admin.routes'
import attendanceRoutes from './attendance.routes'
import authRoutes from './auth.routes'
import creditRoutes from './credit.routes'
import documentRoutes from './document.routes'
import employeeRoutes from './employee.routes'
import hrRoutes from './hr.routes'
import leaveRoutes from './leave.routes'
import monitoringRoutes from './monitoring.routes'
import payrollRoutes from './payroll.routes'
import onboardingRoutes from './onboarding.routes'
import recruitmentRoutes from './recruitment.routes'
import superAdminRoutes from './superadmin.routes'
import paymentRoutes from './payment.routes'
import salaryAdvanceRoutes from './salaryAdvance.routes'
import mobileQrRoutes from './mobileQr.routes'
import trainingRoutes from './training.routes'

const router = Router()

router.get('/health', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'HRMS API is healthy',
    timestamp: new Date().toISOString(),
  })
})

router.use('/auth', authRoutes)
router.use('/superadmin', superAdminRoutes)
router.use('/admin', adminRoutes)
router.use('/hr', hrRoutes)
router.use('/employees', employeeRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/leaves', leaveRoutes)
router.use('/payroll', payrollRoutes)
router.use('/documents', documentRoutes)
router.use('/credits', creditRoutes)
router.use('/monitoring', monitoringRoutes)
router.use('/onboarding', onboardingRoutes)
router.use('/recruitment', recruitmentRoutes)
router.use('/training', trainingRoutes)
router.use('/payments', paymentRoutes)
router.use('/salary-advances', salaryAdvanceRoutes)
router.use('/attendance/mobile-qr', mobileQrRoutes)

export default router
