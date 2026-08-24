import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listVenuesController,
  getVenueController,
  createVenueController,
  updateVenueController,
  deleteVenueController,
  createSeatCategoryController,
  updateSeatCategoryController,
  deleteSeatCategoryController,
  getSeatCategoriesController,
  bulkCreateSeatsController,
  generateGridSeatsController,
  getVenueSeatsController,
} from './venues.controller';
import {
  venueQuerySchema,
  venueIdParamSchema,
  createVenueSchema,
  updateVenueSchema,
  createSeatCategorySchema,
  updateSeatCategorySchema,
  bulkSeatsSchema,
  generateGridSeatsSchema,
} from './venues.validator';

const router = Router();

// Admin: List venues
router.get('/', authenticate, validate(venueQuerySchema), listVenuesController);

// Admin: Get venue details
router.get('/:id', authenticate, validate(venueIdParamSchema), getVenueController);

// Admin: Create venue
router.post('/', authenticate, validate(createVenueSchema), createVenueController);

// Admin: Update venue
router.patch('/:id', authenticate, validate(updateVenueSchema), updateVenueController);

// Admin: Delete venue
router.delete('/:id', authenticate, validate(venueIdParamSchema), deleteVenueController);

// Admin: Seat categories for a venue
router.post('/:id/categories', authenticate, validate(createSeatCategorySchema), createSeatCategoryController);
router.get('/:id/categories', authenticate, validate(venueIdParamSchema), getSeatCategoriesController);
router.patch('/:id/categories/:categoryId', authenticate, validate(updateSeatCategorySchema), updateSeatCategoryController);
router.delete('/:id/categories/:categoryId', authenticate, deleteSeatCategoryController);

// Admin: Bulk create seats (flexible row-based)
router.post('/:id/seats/bulk', authenticate, validate(bulkSeatsSchema), bulkCreateSeatsController);

// Admin: Generate grid seats (simple grid)
router.post('/:id/seats/grid', authenticate, validate(generateGridSeatsSchema), generateGridSeatsController);

// Admin: Get venue seats
router.get('/:id/seats', authenticate, validate(venueIdParamSchema), getVenueSeatsController);

export default router;