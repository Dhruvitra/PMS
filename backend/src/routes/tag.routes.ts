import { Router } from 'express';
import { TagController } from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new TagController();

router.use(authenticate);

router.get('/', controller.getAll);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
