import { Router } from 'express'
import { UserRole } from '@prisma/client'
import { calendarController } from '../controllers/calendar.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

const router = Router()

router.use(authenticate, tenantIsolation)

router.get('/month', calendarController.getMonth)
router.get('/holidays', calendarController.listHolidays)
router.put('/schedule', authorize(UserRole.HR, UserRole.ADMIN, UserRole.SUPER_ADMIN), calendarController.updateSchedule)
router.post('/holidays', authorize(UserRole.HR, UserRole.ADMIN, UserRole.SUPER_ADMIN), calendarController.upsertHoliday)
router.delete('/holidays/:id', authorize(UserRole.HR, UserRole.ADMIN, UserRole.SUPER_ADMIN), calendarController.deleteHoliday)

export default router

