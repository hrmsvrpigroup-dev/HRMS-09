import { Router } from 'express'
import { alertController } from '../controllers/alert.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

const router = Router()

router.use(authenticate, tenantIsolation)

router.get('/my-active', authorize('EMPLOYEE', 'HR', 'ADMIN', 'SUPER_ADMIN'), alertController.getMyActiveAlerts)
router.post('/:id/acknowledge', authorize('EMPLOYEE', 'HR', 'ADMIN', 'SUPER_ADMIN'), alertController.acknowledgeAlert)

router.get('/', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), alertController.listAlerts)
router.post('/', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), alertController.createAlert)
router.patch('/:id/toggle', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), alertController.toggleAlert)
router.delete('/:id', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), alertController.deleteAlert)

export default router

