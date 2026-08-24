import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  getSeatMapController,
  holdSeatsController,
  releaseHoldController,
  confirmBookingController,
  getShowSummaryController,
  setPricingController,
  setBulkPricingController,
} from './shows.controller';
import {
  showIdParamSchema,
  seatMapQuerySchema,
  holdSeatsSchema,
  releaseHoldSchema,
  pricingSchema,
  bulkPricingSchema,
} from './shows.validator';

const router = Router();

// Public: Get seat map for a show
router.get(
  '/:id/seatmap',
  validate(seatMapQuerySchema),
  getSeatMapController
);

// Customer: Hold seats (requires auth)
router.post(
  '/:id/hold',
  authenticate,
  validate(holdSeatsSchema),
  holdSeatsController
);

// Customer: Release hold (requires auth)
router.delete(
  '/holds/:holdId',
  authenticate,
  validate(releaseHoldSchema),
  releaseHoldController
);

// Customer: Confirm booking from held seats (requires auth)
router.post(
  '/:id/book',
  authenticate,
  // validate(confirmBookingSchema), // We'll add this if needed
  confirmBookingController
);

// Organiser/Admin: Get show summary (bookings + revenue)
router.get(
  '/:id/summary',
  authenticate,
  validate(showIdParamSchema),
  getShowSummaryController
);

// Organiser/Admin: Set pricing for a category
router.post(
  '/:id/pricing',
  authenticate,
  validate(pricingSchema),
  setPricingController
);

// Organiser/Admin: Set bulk pricing
router.post(
  '/:id/pricing/bulk',
  authenticate,
  validate(bulkPricingSchema),
  setBulkPricingController
);

export default router;