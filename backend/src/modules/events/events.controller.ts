import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../utils/prisma';
import {
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  createShow,
  getShowsByEvent,
  getOrganiserEvents,
} from './events.service';
import { AppError } from '../../utils/errors';

export async function listEventsController(req: Request, res: Response): Promise<void> {
  const { type, search, page, limit } = req.query as {
    type?: 'MOVIE' | 'CONCERT';
    search?: string;
    page?: string;
    limit?: string;
  };

  const result = await listEvents({
    type,
    search,
    page: parseInt(page || '1', 10),
    limit: parseInt(limit || '20', 10),
  });

  res.json({ success: true, data: result });
}

export async function getEventController(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const event = await getEventById(id);
  res.json({ success: true, data: event });
}

export async function createEventController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ORGANISER' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Only organisers and admins can create events');
  }

  const event = await createEvent(user.id, req.body);
  res.status(201).json({ success: true, data: event });
}

export async function updateEventController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  if (user.role !== 'ADMIN') {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.organiserId !== user.id) {
      throw AppError.forbidden('Not authorized to update this event');
    }
  }

  const event = await updateEvent(id, user.id, req.body);
  res.json({ success: true, data: event });
}

export async function deleteEventController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  if (user.role !== 'ADMIN') {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.organiserId !== user.id) {
      throw AppError.forbidden('Not authorized to delete this event');
    }
  }

  await deleteEvent(id, user.id);
  res.json({ success: true, data: { message: 'Event deleted' } });
}

export async function createShowController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ORGANISER' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Only organisers and admins can create shows');
  }

  const { eventId, date, time } = req.body;
  const show = await createShow(user.id, { eventId, date: new Date(date), time });

  res.status(201).json({ success: true, data: show });
}

export async function getShowsByEventController(req: Request, res: Response): Promise<void> {
  const { eventId } = req.params;
  const shows = await getShowsByEvent(eventId);
  res.json({ success: true, data: shows });
}

export async function getOrganiserEventsController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ORGANISER' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Only organisers and admins can view organiser events');
  }

  const events = await getOrganiserEvents(user.id);
  res.json({ success: true, data: events });
}