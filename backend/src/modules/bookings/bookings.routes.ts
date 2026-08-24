import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { getMyBookingsController } from './bookings.controller';

const router = Router();

// Customer: Get own bookings
router.get('/me', authenticate, getMyBookingsController);

export default router;
