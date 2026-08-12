import { Router } from 'express';
import { createOrder } from '../controllers/order.controller';
import { authenticate, requireRole } from '../middlewares/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('CUSTOMER'));

router.post('/', createOrder);

export default router;