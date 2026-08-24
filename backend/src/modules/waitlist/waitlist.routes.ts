import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  joinWaitlistController,
  getMyWaitlistController,
  getWaitlistOfferController,
  acceptWaitlistOfferController,
  cancelBookingController,
  expireOfferController,
} from './waitlist.controller';
import {
  joinWaitlistSchema,
  waitlistIdParamSchema,
  acceptOfferSchema,
  offerTokenParamSchema,
} from './waitlist.validator';

const router = Router();

// Customer: Join waitlist for a show category
router.post('/shows/:id/waitlist', authenticate, validate(joinWaitlistSchema), joinWaitlistController);

// Customer: Get my waitlist entries
router.get('/waitlist/me', authenticate, getMyWaitlistController);

// Public: Get waitlist offer details (for email link)
router.get('/waitlist-offers/:token', validate(offerTokenParamSchema), getWaitlistOfferController);

// Customer: Accept waitlist offer
router.post('/waitlist-offers/:token/accept', authenticate, validate(acceptOfferSchema), acceptWaitlistOfferController);

// Customer: Cancel booking (triggers waitlist)
router.delete('/bookings/:id', authenticate, validate(waitlistIdParamSchema), cancelBookingController);

// Internal: Expire waitlist offer (called by BullMQ worker)
router.post('/internal/waitlist-offers/:token/expire', expireOfferController);

export default router;