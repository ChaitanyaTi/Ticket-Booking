import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listEventsController,
  getEventController,
  createEventController,
  updateEventController,
  deleteEventController,
  createShowController,
  getShowsByEventController,
  getOrganiserEventsController,
} from './events.controller';
import {
  eventQuerySchema,
  eventIdParamSchema,
  createEventSchema,
  updateEventSchema,
  createShowSchema,
  showIdParamSchema,
} from './events.validator';

const router = Router();

// Public: List events with filters
router.get('/', validate(eventQuerySchema), listEventsController);

// Public: Get event details
router.get('/:id', validate(eventIdParamSchema), getEventController);

// Organiser/Admin: Get organiser's events
router.get('/organiser/events', authenticate, getOrganiserEventsController);

// Organiser/Admin: Create event
router.post('/', authenticate, validate(createEventSchema), createEventController);

// Organiser/Admin: Update event
router.patch('/:id', authenticate, validate(updateEventSchema), updateEventController);

// Organiser/Admin: Delete event
router.delete('/:id', authenticate, validate(eventIdParamSchema), deleteEventController);

// Organiser/Admin: Create show for an event
router.post('/:id/shows', authenticate, validate(createShowSchema), createShowController);

// Public: Get shows for an event
router.get('/:eventId/shows', validate(showIdParamSchema), getShowsByEventController);

export default router;