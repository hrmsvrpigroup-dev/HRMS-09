import { Router } from 'express'
import { trainingController } from '../controllers/training.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

const router = Router()

router.use(authenticate, authorize('ADMIN', 'HR'), tenantIsolation)

router.post('/test-teams-connection', trainingController.testTeamsConnection)
router.post('/generate-teams-link', trainingController.generateTeamsLink)
router.post('/send-invitations', trainingController.sendTrainingInvitations)

export default router
