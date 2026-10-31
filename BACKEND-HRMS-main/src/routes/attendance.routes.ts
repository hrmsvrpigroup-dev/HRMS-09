import { Router } from 'express'
import { attendanceController } from '../controllers/attendance.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

const router = Router()

// Informational route for browser GET requests to manual-clock-in API URL
router.get('/manual-clock-in', (_req: any, res: any) => {
  return res.status(200).json({
    success: true,
    message: 'Manual Attendance API is active. To record manual attendance, log in to the HR Portal at /hr/manual-attendance and submit the Force Clock In form.',
    endpoint: 'POST /api/attendance/manual-clock-in',
  })
})

// Public photo stream route for <img> tags
router.get('/:id/photo', attendanceController.getPhoto)

router.use(authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'HR', 'EMPLOYEE'), tenantIsolation)

router.get('/', attendanceController.list)
router.post('/clock-in', attendanceController.clockIn)
router.post('/clock-out', attendanceController.clockOut)
router.get('/today', attendanceController.todayStatus)
router.post('/idle', attendanceController.logIdle)
router.delete('/:id/reset', attendanceController.resetShift)
router.post('/:id/continue', attendanceController.continueShift)
router.post('/manual-clock-in', authorize('SUPER_ADMIN', 'ADMIN', 'HR'), attendanceController.manualClockIn)
router.post('/sync-google-sheets', authorize('SUPER_ADMIN', 'ADMIN', 'HR'), attendanceController.syncAllGoogleSheets)

export default router