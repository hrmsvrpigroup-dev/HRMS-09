import { Router } from 'express'
import { trainingController } from '../controllers/training.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/rbac.middleware'
import { tenantIsolation } from '../middleware/tenant.middleware'

const router = Router()

router.use(authenticate, tenantIsolation)

router.get('/my-sessions', authorize('EMPLOYEE', 'ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.getMySessions)
router.get('/sessions', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.listSessions)
router.patch('/sessions/:sessionId/attendance', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.markParticipantAttendance)
router.patch('/sessions/:sessionId/cancel', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.cancelSession)

router.post('/test-teams-connection', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.testTeamsConnection)
router.post('/generate-teams-link', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.generateTeamsLink)
router.post('/send-invitations', authorize('ADMIN', 'HR', 'SUPER_ADMIN'), trainingController.sendTrainingInvitations)

export default router
