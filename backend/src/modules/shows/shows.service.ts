import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';
import { config } from '../../config';
import { getRedisClient } from '../../utils/redis';
import { Queue } from 'bullmq';
import { sendBookingConfirmationEmail, generateQRCode } from '../email/email.service';
import { getIo } from '../../utils/socket';

const HOLD_TTL_MINUTES = config.holdTtlMinutes || 10;
const HOLD_TTL_MS = HOLD_TTL_MINUTES * 60 * 1000;

// BullMQ queue for releasing holds
let releaseHoldQueue: Queue | null = null;

export function getReleaseHoldQueue(): Queue {
  if (!releaseHoldQueue) {
    const redis = getRedisClient();
    releaseHoldQueue = new Queue('release-hold', { connection: redis });
  }
  return releaseHoldQueue;
}

export interface SeatMapSeat {
  id: string;
  seatId: string;
  rowLabel: string;
  seatNumber: number;
  x: number;
  y: number;
  categoryId: string;
  categoryName: string;
  categoryBaseLabel: string;
  status: string;
  heldByUserId: string | null;
  holdExpiresAt: Date | null;
  price: number;
}

export interface SeatMapResponse {
  show: {
    id: string;
    eventId: string;
    eventTitle: string;
    eventType: string;
    venueId: string;
    venueName: string;
    date: Date;
    time: string;
    status: string;
  };
  seats: SeatMapSeat[];
  categories: Array<{
    id: string;
    name: string;
    baseLabel: string;
    price: number;
  }>;
}

export interface HoldResult {
  holdId: string;
  seats: Array<{
    showSeatId: string;
    seatId: string;
    rowLabel: string;
    seatNumber: number;
    categoryName: string;
    holdExpiresAt: Date;
  }>;
  expiresAt: Date;
}

export async function getShowById(showId: string) {
  return prisma.show.findUnique({
    where: { id: showId },
    include: {
      event: {
        include: {
          venue: true,
        },
      },
    },
  });
}

export async function getSeatMap(showId: string, categoryId?: string): Promise<SeatMapResponse> {
  const show = await getShowById(showId);
  if (!show) {
    throw AppError.notFound('Show not found');
  }

  // Get pricing for all categories in this show
  const pricing = await prisma.showSeatPricing.findMany({
    where: { showId },
    include: { category: true },
  });

  const pricingMap = new Map<string, number>(pricing.map((p: any) => [p.categoryId, p.price]));

  // Get all seat categories for this venue
  const categories = await prisma.seatCategory.findMany({
    where: { venueId: show.event.venueId },
    orderBy: { name: 'asc' },
  });

  // Build where clause for ShowSeat
  const where: { showId: string; seat?: { categoryId: string } } = { showId };
  if (categoryId) {
    where.seat = { categoryId };
  }

  const showSeats = await prisma.showSeat.findMany({
    where,
    include: {
      seat: {
        include: { category: true },
      },
    },
    orderBy: [
      { seat: { category: { name: 'asc' } } },
      { seat: { rowLabel: 'asc' } },
      { seat: { seatNumber: 'asc' } },
    ],
  });

  const seats: SeatMapSeat[] = showSeats.map((ss: any) => ({
    id: ss.id,
    seatId: ss.seatId,
    rowLabel: ss.seat.rowLabel,
    seatNumber: ss.seat.seatNumber,
    x: ss.seat.x,
    y: ss.seat.y,
    categoryId: ss.seat.categoryId,
    categoryName: ss.seat.category.name,
    categoryBaseLabel: ss.seat.category.baseLabel,
    status: ss.status,
    heldByUserId: ss.heldByUserId,
    holdExpiresAt: ss.holdExpiresAt,
    price: pricingMap.get(ss.seat.categoryId) || 0,
  }));

  return {
    show: {
      id: show.id,
      eventId: show.eventId,
      eventTitle: show.event.title,
      eventType: show.event.type,
      venueId: show.event.venueId,
      venueName: show.event.venue.name,
      date: show.date,
      time: show.time,
      status: show.status,
    },
    seats,
    categories: categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      baseLabel: c.baseLabel,
      price: pricingMap.get(c.id) || 0,
    })),
  };
}

export async function holdSeats(showId: string, userId: string, seatIds: string[]): Promise<HoldResult> {
  const show = await getShowById(showId);
  if (!show) {
    throw AppError.notFound('Show not found');
  }
  if (show.status !== 'UPCOMING') {
    throw AppError.badRequest('Cannot hold seats for non-upcoming show');
  }

  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);

  // Use a transaction with SELECT FOR UPDATE to prevent race conditions
  let result;
  try {
    result = await prisma.$transaction(async (tx: any) => {
      // Lock the ShowSeat rows for the requested seats
    const showSeats = await tx.showSeat.findMany({
      where: {
        showId,
        id: { in: seatIds },
      },
      include: {
        seat: { include: { category: true } },
      },
    });

    if (showSeats.length !== seatIds.length) {
      throw AppError.notFound('One or more seats not found for this show');
    }

    // Check all seats are available
    const unavailable = showSeats.filter((s: any) => s.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      const seatCodes = unavailable.map((s: any) => `${s.seat.category.baseLabel}${s.seat.rowLabel}${s.seat.seatNumber}`).join(', ');
      throw AppError.conflict(`Seats no longer available: ${seatCodes}`);
    }

    // Update all seats to HELD
    const updatedSeats = await Promise.all(
      showSeats.map((ss: any) =>
        tx.showSeat.update({
          where: { id: ss.id },
          data: {
            status: 'HELD',
            heldByUserId: userId,
            heldAt: now,
            holdExpiresAt,
          },
          include: { seat: { include: { category: true } } },
        })
      )
    );

    return updatedSeats;
  }, {
    isolationLevel: 'Serializable' as any, // Highest isolation for safety
    maxWait: 5000,
    timeout: 10000,
  });
  } catch (error: any) {
    if (error.code === 'P2034') {
      throw AppError.conflict('Seats are currently being modified by another user. Please try again.');
    }
    throw error;
  }

  // Generate a hold ID (using first seat's showSeatId as reference, or create a hold record)
  // For simplicity, we'll use a composite hold reference
  const holdId = `hold_${showId}_${userId}_${Date.now()}`;

  // Enqueue delayed job to release hold after TTL
  try {
    const queue = getReleaseHoldQueue();
    await queue.add(
      'release-hold',
      { showSeatIds: result.map((s: any) => s.id), userId, holdId },
      { delay: HOLD_TTL_MS, jobId: holdId, removeOnComplete: true, removeOnFail: false }
    );
  } catch (err) {
    console.error('[holdSeats] Failed to enqueue release hold job (falling back to sweep cron):', err);
  }

  // Broadcast seat:held events
  const io = getIo();
  result.forEach((s: any) => {
    io.to(`show:${showId}`).emit('seat:held', {
      seatId: s.seatId,
      holdExpiresAt,
    });
  });

  return {
    holdId,
    seats: result.map((s: any) => ({
      showSeatId: s.id,
      seatId: s.seatId,
      rowLabel: s.seat.rowLabel,
      seatNumber: s.seat.seatNumber,
      categoryName: s.seat.category.name,
      holdExpiresAt,
    })),
    expiresAt: holdExpiresAt,
  };
}

export async function releaseHold(showSeatIds: string[], userId: string): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    // Only release if still held by this user and not booked
    const showSeats = await tx.showSeat.findMany({
      where: {
        id: { in: showSeatIds },
        status: 'HELD',
        heldByUserId: userId,
      },
    });

    if (showSeats.length === 0) return; // Already booked or released

    await tx.showSeat.updateMany({
      where: {
        id: { in: showSeatIds },
        status: 'HELD',
        heldByUserId: userId,
      },
      data: {
        status: 'AVAILABLE',
        heldByUserId: null,
        heldAt: null,
        holdExpiresAt: null,
      },
    });
    
    // Broadcast seat:released events
    const io = getIo();
    showSeats.forEach((s: any) => {
      io.to(`show:${s.showId}`).emit('seat:released', {
        seatId: s.seatId,
      });
    });
  });
}

export async function confirmBooking(
  showId: string,
  userId: string,
  showSeatIds: string[],
  customEmail?: string
): Promise<{ bookingId: string; bookingRef: string; totalAmount: number; seats: typeof showSeatIds; qrCodeUrl: string }> {
  const show = await getShowById(showId);
  if (!show) {
    throw AppError.notFound('Show not found');
  }

  const result = await prisma.$transaction(async (tx: any) => {
    // Verify all seats are held by this user
    const showSeats = await tx.showSeat.findMany({
      where: {
        id: { in: showSeatIds },
        showId,
        status: 'HELD',
        heldByUserId: userId,
      },
      include: {
        seat: { include: { category: true } },
      },
    });

    if (showSeats.length !== showSeatIds.length) {
      throw AppError.conflict('One or more seats no longer held by you');
    }

    // Fetch pricing for this show
    const pricingData = await tx.showSeatPricing.findMany({
      where: { showId },
    });
    const pricingMap = new Map<string, number>(pricingData.map((p: any) => [p.categoryId, Number(p.price)]));

    // Calculate total
    const totalAmount = showSeats.reduce((sum: number, s: any) => sum + (pricingMap.get(s.seat.categoryId) || 0), 0);

    // Generate booking reference
    const bookingRef = `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create booking
    const booking = await tx.booking.create({
      data: {
        bookingRef,
        userId,
        showId,
        status: 'CONFIRMED',
        totalAmount,
        seats: {
          create: showSeats.map((ss: any) => ({
            showSeatId: ss.id,
          })),
        },
      },
    });

    // Update seats to BOOKED
    await tx.showSeat.updateMany({
      where: { id: { in: showSeatIds } },
      data: {
        status: 'BOOKED',
        heldByUserId: null,
        heldAt: null,
        holdExpiresAt: null,
      },
    });

    // Broadcast seat:booked events
    const io = getIo();
    showSeats.forEach((s: any) => {
      io.to(`show:${showId}`).emit('seat:booked', {
        seatId: s.seatId,
      });
    });

    // Remove the hold release job from queue
    const queue = getReleaseHoldQueue();
    // Note: We'd need to track job IDs per seat to remove specific jobs
    // For now, the job will fire but find seats already BOOKED and do nothing

    // Send confirmation email (non-blocking)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const event = await prisma.event.findUnique({ where: { id: show.eventId }, select: { title: true, type: true, venue: { select: { name: true, address: true } } } });

    if (user && event) {
      const seatsWithDetails = showSeats.map((ss: any) => ({
        rowLabel: ss.seat.rowLabel,
        seatNumber: ss.seat.seatNumber,
        categoryName: ss.seat.category.name,
      }));

      sendBookingConfirmationEmail({
        bookingRef,
        userName: user.name,
        userEmail: customEmail || user.email,
        eventTitle: event.title,
        eventType: event.type,
        venueName: event.venue.name,
        venueAddress: event.venue.address,
        showDate: show.date,
        showTime: show.time,
        seats: seatsWithDetails,
        totalAmount,
      }).catch((err) => console.error('Failed to send booking confirmation email:', err));
    }

    const qrData = JSON.stringify({ bookingRef, type: 'booking' });
    const qrCodeUrl = await generateQRCode(qrData);

    return { bookingId: booking.id, bookingRef, totalAmount, seats: showSeatIds, qrCodeUrl };
  }, {
    isolationLevel: 'Serializable' as any,
    maxWait: 5000,
    timeout: 10000,
  });

  return result;
}

export async function getShowSummary(showId: string): Promise<{
  show: any;
  stats: { totalSeats: number; available: number; held: number; booked: number; revenue: number };
  categoryStats: Array<{ categoryName: string; bookings: number; revenue: number }>;
  bookings: Array<{ id: string; bookingRef: string; userName: string; userEmail: string; seatCount: number; amount: number; createdAt: Date }>;
}> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { event: { include: { venue: true } } },
  });
  if (!show) throw AppError.notFound('Show not found');

  const [seatStats, bookings] = await Promise.all([
    prisma.showSeat.groupBy({
      by: ['status'],
      where: { showId },
      _count: true,
    }),
    prisma.booking.findMany({
      where: { showId, status: 'CONFIRMED' },
      include: {
        user: { select: { name: true, email: true } },
        seats: { 
          include: { 
            showSeat: { 
              include: { seat: { include: { category: true } } } 
            } 
          } 
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const stats = seatStats.reduce((acc: { totalSeats: number; available: number; held: number; booked: number }, s: any) => {
    const key = s.status.toLowerCase() as keyof typeof acc;
    if (key in acc) {
      acc[key] = s._count;
    }
    return acc;
  }, { totalSeats: 0, available: 0, held: 0, booked: 0 });

  stats.totalSeats = (Object.values(stats) as number[]).reduce((a: number, b: number) => a + b, 0);
  const revenue = bookings.reduce((sum: number, b: any) => sum + b.totalAmount, 0);

  // Group by category for charts
  const catStatsMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    for (const bs of b.seats) {
      const catName = bs.showSeat?.seat?.category?.name || 'Unknown';
      // To get revenue per category, we would need to know the price of this specific seat.
      // Since booking.totalAmount is the total, and we didn't store per-seat price in BookingSeat,
      // we can estimate it or fetch pricing. Let's fetch pricing.
      if (!catStatsMap.has(catName)) catStatsMap.set(catName, { bookings: 0, revenue: 0 });
      catStatsMap.get(catName)!.bookings += 1;
    }
  }

  // To accurately get category revenue, fetch current pricing (assuming it hasn't changed since booking, 
  // or we just use current pricing as a baseline, since the DB schema lacks a historic per-seat price log).
  const pricings = await prisma.showSeatPricing.findMany({ where: { showId }, include: { category: true } });
  const priceMap = new Map(pricings.map((p: any) => [p.category.name, p.price]));
  
  const categoryStats = Array.from(catStatsMap.entries()).map(([categoryName, data]) => ({
    categoryName,
    bookings: data.bookings,
    revenue: data.bookings * (priceMap.get(categoryName) || 0),
  }));

  return {
    show,
    stats: { ...stats, revenue },
    categoryStats,
    bookings: bookings.map((b: any) => ({
      id: b.id,
      bookingRef: b.bookingRef,
      userName: b.user.name,
      userEmail: b.user.email,
      seatCount: b.seats.length,
      amount: b.totalAmount,
      createdAt: b.createdAt,
    })),
  };
}

export async function setShowPricing(showId: string, categoryId: string, price: number): Promise<void> {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw AppError.notFound('Show not found');

  await prisma.showSeatPricing.upsert({
    where: { showId_categoryId: { showId, categoryId } },
    update: { price },
    create: { showId, categoryId, price },
  });
}

export async function setBulkPricing(showId: string, pricing: Array<{ categoryId: string; price: number }>): Promise<void> {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw AppError.notFound('Show not found');

  await prisma.$transaction(
    pricing.map((p: any) =>
      prisma.showSeatPricing.upsert({
        where: { showId_categoryId: { showId, categoryId: p.categoryId } },
        update: { price: p.price },
        create: { showId, categoryId: p.categoryId, price: p.price },
      })
    )
  );
}