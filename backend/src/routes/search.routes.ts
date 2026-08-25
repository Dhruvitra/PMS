import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new SearchController();

router.use(authenticate);

router.get('/', controller.search);

export default router;
