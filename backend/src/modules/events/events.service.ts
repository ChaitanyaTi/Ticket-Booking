import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

export interface EventListItem {
  id: string;
  title: string;
  description: string | null;
  type: 'MOVIE' | 'CONCERT';
  venue: { id: string; name: string; address: string };
  shows: Array<{
    id: string;
    date: Date;
    time: string;
    status: string;
  }>;
  createdAt: Date;
}

export interface EventDetail extends EventListItem {
  organiser: { id: string; name: string; email: string };
}

export async function listEvents(query: {
  type?: 'MOVIE' | 'CONCERT';
  search?: string;
  page: number;
  limit: number;
}): Promise<{ events: EventListItem[]; total: number; page: number; totalPages: number }> {
  const { type, search, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.EventWhereInput = {};

  if (type) {
    where.type = type;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { venue: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true, address: true } },
        shows: {
          where: { status: 'UPCOMING' },
          orderBy: { date: 'asc' },
          select: { id: true, date: true, time: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events: events as EventListItem[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getEventById(eventId: string): Promise<EventDetail> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      venue: { select: { id: true, name: true, address: true } },
      organiser: { select: { id: true, name: true, email: true } },
      shows: {
        where: { status: 'UPCOMING' },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, time: true, status: true },
      },
    },
  });

  if (!event) {
    throw AppError.notFound('Event not found');
  }

  return event as EventDetail;
}

export async function createEvent(
  organiserId: string,
  input: { title: string; description?: string; type: 'MOVIE' | 'CONCERT'; venueId: string }
): Promise<EventDetail> {
  const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  const event = await prisma.event.create({
    data: {
      organiserId,
      venueId: input.venueId,
      title: input.title,
      description: input.description,
      type: input.type,
    },
    include: {
      venue: { select: { id: true, name: true, address: true } },
      organiser: { select: { id: true, name: true, email: true } },
      shows: { select: { id: true, date: true, time: true, status: true } },
    },
  });

  return event as EventDetail;
}

export async function updateEvent(
  eventId: string,
  organiserId: string,
  input: { title?: string; description?: string; type?: 'MOVIE' | 'CONCERT'; venueId?: string }
): Promise<EventDetail> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw AppError.notFound('Event not found');
  }
  if (event.organiserId !== organiserId) {
    throw AppError.forbidden('Not authorized to update this event');
  }

  if (input.venueId) {
    const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
    if (!venue) {
      throw AppError.notFound('Venue not found');
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: input,
    include: {
      venue: { select: { id: true, name: true, address: true } },
      organiser: { select: { id: true, name: true, email: true } },
      shows: { select: { id: true, date: true, time: true, status: true } },
    },
  });

  return updated as EventDetail;
}

export async function deleteEvent(eventId: string, organiserId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw AppError.notFound('Event not found');
  }
  if (event.organiserId !== organiserId) {
    throw AppError.forbidden('Not authorized to delete this event');
  }

  await prisma.event.delete({ where: { id: eventId } });
}

export async function createShow(
  organiserId: string,
  input: { eventId: string; date: Date; time: string }
): Promise<{ id: string; eventId: string; date: Date; time: string; status: string }> {
  const event = await prisma.event.findUnique({ 
    where: { id: input.eventId },
    include: { venue: { include: { seats: true } } }
  });
  if (!event) {
    throw AppError.notFound('Event not found');
  }
  if (event.organiserId !== organiserId) {
    throw AppError.forbidden('Not authorized to create shows for this event');
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const show = await tx.show.create({
      data: {
        eventId: input.eventId,
        date: input.date,
        time: input.time,
        status: 'UPCOMING',
      },
    });

    if (event.venue.seats.length > 0) {
      await tx.showSeat.createMany({
        data: event.venue.seats.map((seat: any) => ({
          showId: show.id,
          seatId: seat.id,
          status: 'AVAILABLE',
        })),
      });
    }

    return show;
  });

  return result;
}

export async function getShowsByEvent(eventId: string) {
  return prisma.show.findMany({
    where: { eventId },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, time: true, status: true, createdAt: true },
  });
}

export async function getOrganiserEvents(organiserId: string): Promise<EventListItem[]> {
  const events = await prisma.event.findMany({
    where: { organiserId },
    include: {
      venue: { select: { id: true, name: true, address: true } },
      shows: {
        orderBy: { date: 'asc' },
        select: { id: true, date: true, time: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return events as EventListItem[];
}