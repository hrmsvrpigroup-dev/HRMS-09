import { Router } from 'express'
import { leaveController } from '../controllers/leave.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

const router = Router()

router.use(authenticate, authorize('ADMIN', 'HR', 'EMPLOYEE'), tenantIsolation)

router.get('/notifications', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), leaveController.getNotifications)
router.get('/', leaveController.list)
router.post('/', leaveController.create)
router.patch('/:id', leaveController.approve)

export default router
