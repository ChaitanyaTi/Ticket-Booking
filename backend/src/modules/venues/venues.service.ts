import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

export interface VenueListItem {
  id: string;
  name: string;
  address: string;
  createdByAdmin: { id: string; name: string; email: string };
  seatCategories: Array<{ id: string; name: string; baseLabel: string; _count: { seats: number } }>;
  _count: { events: number; seats: number };
  createdAt: Date;
}

export async function listVenues(query: { page: number; limit: number }): Promise<{ venues: VenueListItem[]; total: number; page: number; totalPages: number }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [venues, total] = await Promise.all([
    prisma.venue.findMany({
      include: {
        createdByAdmin: { select: { id: true, name: true, email: true } },
        seatCategories: {
          include: { _count: { select: { seats: true } } },
        },
        _count: { select: { events: true, seats: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.venue.count(),
  ]);

  return {
    venues: venues as VenueListItem[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getVenueById(venueId: string): Promise<VenueListItem> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      createdByAdmin: { select: { id: true, name: true, email: true } },
      seatCategories: {
        include: { _count: { select: { seats: true } } },
      },
      _count: { select: { events: true, seats: true } },
    },
  });

  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  return venue as VenueListItem;
}

export async function createVenue(adminId: string, input: { name: string; address: string }): Promise<VenueListItem> {
  const venue = await prisma.venue.create({
    data: {
      name: input.name,
      address: input.address,
      createdByAdminId: adminId,
    },
    include: {
      createdByAdmin: { select: { id: true, name: true, email: true } },
      seatCategories: { include: { _count: { select: { seats: true } } } },
      _count: { select: { events: true, seats: true } },
    },
  });

  return venue as VenueListItem;
}

export async function updateVenue(venueId: string, input: { name?: string; address?: string }): Promise<VenueListItem> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  const updated = await prisma.venue.update({
    where: { id: venueId },
    data: input,
    include: {
      createdByAdmin: { select: { id: true, name: true, email: true } },
      seatCategories: { include: { _count: { select: { seats: true } } } },
      _count: { select: { events: true, seats: true } },
    },
  });

  return updated as VenueListItem;
}

export async function deleteVenue(venueId: string): Promise<void> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  // Prevent deleting venue if it has shows
  const showCount = await prisma.show.count({
    where: { event: { venueId } },
  });

  if (showCount > 0) {
    throw AppError.conflict('Cannot delete a venue that has scheduled shows. Delete the events/shows first.');
  }

  await prisma.venue.delete({ where: { id: venueId } });
}

export async function createSeatCategory(venueId: string, input: { name: string; baseLabel: string }) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  return prisma.seatCategory.create({
    data: {
      venueId,
      name: input.name,
      baseLabel: input.baseLabel,
    },
  });
}

export async function updateSeatCategory(categoryId: string, input: { name?: string; baseLabel?: string }) {
  const category = await prisma.seatCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw AppError.notFound('Seat category not found');
  }

  return prisma.seatCategory.update({
    where: { id: categoryId },
    data: input,
  });
}

export async function deleteSeatCategory(categoryId: string) {
  const category = await prisma.seatCategory.findUnique({ 
    where: { id: categoryId },
    include: { _count: { select: { seats: true } } }
  });
  
  if (!category) {
    throw AppError.notFound('Seat category not found');
  }

  if (category._count.seats > 0) {
    await prisma.seat.deleteMany({ where: { categoryId } });
  }

  await prisma.seatCategory.delete({ where: { id: categoryId } });
}

export async function getSeatCategories(venueId: string) {
  return prisma.seatCategory.findMany({
    where: { venueId },
    orderBy: { name: 'asc' },
  });
}

export async function bulkCreateSeats(venueId: string, categoryId: string, rows: Array<{
  rowLabel: string;
  seatCount: number;
  startX: number;
  startY: number;
  xStep: number;
  yStep: number;
}>) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  const category = await prisma.seatCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.venueId !== venueId) {
    throw AppError.notFound('Seat category not found for this venue');
  }

  // Check for existing seats to determine next seat numbers per row
  const existingSeats = await prisma.seat.findMany({
    where: { venueId, categoryId },
    select: { rowLabel: true, seatNumber: true },
  });

  const maxSeatByRow = new Map<string, number>();
  for (const seat of existingSeats) {
    const current = maxSeatByRow.get(seat.rowLabel) || 0;
    if (seat.seatNumber > current) {
      maxSeatByRow.set(seat.rowLabel, seat.seatNumber);
    }
  }

  const seatsToCreate: Prisma.SeatCreateManyInput[] = [];

  for (const row of rows) {
    const startNumber = (maxSeatByRow.get(row.rowLabel) || 0) + 1;
    for (let i = 0; i < row.seatCount; i++) {
      seatsToCreate.push({
        venueId,
        categoryId,
        rowLabel: row.rowLabel,
        seatNumber: startNumber + i,
        x: row.startX + i * row.xStep,
        y: row.startY + i * row.yStep,
      });
    }
  }

  const result = await prisma.seat.createMany({ data: seatsToCreate });
  return { created: result.count };
}

export async function generateGridSeats(venueId: string, categoryId: string, input: {
  rows: number;
  seatsPerRow: number;
  startX: number;
  startY: number;
  xSpacing: number;
  ySpacing: number;
  rowLabels?: string[];
}) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw AppError.notFound('Venue not found');
  }

  const category = await prisma.seatCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.venueId !== venueId) {
    throw AppError.notFound('Seat category not found for this venue');
  }

  // Check for existing seats to determine next seat numbers
  const existingSeats = await prisma.seat.findMany({
    where: { venueId, categoryId },
    select: { rowLabel: true, seatNumber: true },
  });

  const maxSeatByRow = new Map<string, number>();
  for (const seat of existingSeats) {
    const current = maxSeatByRow.get(seat.rowLabel) || 0;
    if (seat.seatNumber > current) {
      maxSeatByRow.set(seat.rowLabel, seat.seatNumber);
    }
  }

  const seatsToCreate: Prisma.SeatCreateManyInput[] = [];

  for (let r = 0; r < input.rows; r++) {
    const rowLabel = input.rowLabels?.[r] || String.fromCharCode(65 + r); // A, B, C...
    const startNumber = (maxSeatByRow.get(rowLabel) || 0) + 1;

    for (let s = 0; s < input.seatsPerRow; s++) {
      seatsToCreate.push({
        venueId,
        categoryId,
        rowLabel,
        seatNumber: startNumber + s,
        x: input.startX + s * input.xSpacing,
        y: input.startY + r * input.ySpacing,
      });
    }
  }

  const result = await prisma.seat.createMany({ data: seatsToCreate });
  return { created: result.count };
}

export async function getVenueSeats(venueId: string, categoryId?: string) {
  const where: Prisma.SeatWhereInput = { venueId };
  if (categoryId) where.categoryId = categoryId;

  return prisma.seat.findMany({
    where,
    include: { category: true },
    orderBy: [
      { category: { name: 'asc' } },
      { rowLabel: 'asc' },
      { seatNumber: 'asc' },
    ],
  });
}