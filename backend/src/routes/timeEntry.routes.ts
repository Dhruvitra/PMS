import { Router } from 'express';
import { TimeEntryController } from '../controllers/timeEntry.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new TimeEntryController();

router.use(authenticate);

// Time entry by ID routes (mounted at /time-entries)
router.get('/all', controller.getAll);
router.put('/:id/stop', controller.stop);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
