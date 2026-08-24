import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';
import { config } from '../../config';
import { getReleaseHoldQueue } from '../shows/shows.service';
import { v4 as uuidv4 } from 'uuid';
import { sendWaitlistOfferEmail } from '../email/email.service';

const OFFER_TTL_MINUTES = config.waitlistOfferTtlMinutes || 15;
const OFFER_TTL_MS = OFFER_TTL_MINUTES * 60 * 1000;

export interface WaitlistEntryResponse {
  id: string;
  showId: string;
  categoryId: string;
  categoryName: string;
  userId: string;
  status: string;
  position: number;
  createdAt: Date;
}

export interface WaitlistOfferResponse {
  id: string;
  waitlistEntryId: string;
  showSeatId: string;
  seat: { rowLabel: string; seatNumber: number; categoryName: string };
  offerToken: string;
  expiresAt: Date;
  status: string;
}

export async function joinWaitlist(
  showId: string,
  userId: string,
  categoryId: string
): Promise<WaitlistEntryResponse> {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { event: true },
  });
  if (!show) {
    throw AppError.notFound('Show not found');
  }
  if (show.status !== 'UPCOMING') {
    throw AppError.badRequest('Cannot join waitlist for non-upcoming show');
  }

  const category = await prisma.seatCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw AppError.notFound('Category not found');
  }

  // Check if user already has a waitlist entry for this show+category
  const existing = await prisma.waitlistEntry.findUnique({
    where: { showId_categoryId_userId: { showId, categoryId, userId } },
  });
  if (existing) {
    throw AppError.conflict('Already on waitlist for this category');
  }

  // Get the next position
  const lastEntry = await prisma.waitlistEntry.findFirst({
    where: { showId, categoryId, status: 'WAITING' },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const nextPosition = (lastEntry?.position || 0) + 1;

  const entry = await prisma.waitlistEntry.create({
    data: {
      showId,
      categoryId,
      userId,
      status: 'WAITING',
      position: nextPosition,
    },
    include: { category: true },
  });

  return {
    id: entry.id,
    showId: entry.showId,
    categoryId: entry.categoryId,
    categoryName: entry.category.name,
    userId: entry.userId,
    status: entry.status,
    position: entry.position,
    createdAt: entry.createdAt,
  };
}

export async function getUserWaitlistEntries(userId: string): Promise<WaitlistEntryResponse[]> {
  const entries = await prisma.waitlistEntry.findMany({
    where: { userId },
    include: { category: true, show: { include: { event: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return entries.map((e: any) => ({
    id: e.id,
    showId: e.showId,
    categoryId: e.categoryId,
    categoryName: e.category.name,
    userId: e.userId,
    status: e.status,
    position: e.position,
    createdAt: e.createdAt,
  }));
}

export async function getWaitlistOfferByToken(token: string): Promise<WaitlistOfferResponse | null> {
  const offer = await prisma.waitlistOffer.findUnique({
    where: { offerToken: token },
    include: {
      showSeat: { include: { seat: { include: { category: true } } } },
      waitlistEntry: { include: { category: true } },
    },
  });

  if (!offer) return null;

  return {
    id: offer.id,
    waitlistEntryId: offer.waitlistEntryId,
    showSeatId: offer.showSeatId,
    seat: {
      rowLabel: offer.showSeat.seat.rowLabel,
      seatNumber: offer.showSeat.seat.seatNumber,
      categoryName: offer.showSeat.seat.category.name,
    },
    offerToken: offer.offerToken,
    expiresAt: offer.expiresAt,
    status: offer.status,
  };
}

export async function acceptWaitlistOffer(token: string, userId: string): Promise<{
  bookingId: string;
  bookingRef: string;
  totalAmount: number;
  seat: { rowLabel: string; seatNumber: number; categoryName: string };
}> {
  const bookingRef = `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const booking = await prisma.$transaction(async (tx: any) => {
    // 1. Atomically retrieve the offer and related data inside the transaction
    const offer = await tx.waitlistOffer.findUnique({
      where: { offerToken: token },
      include: {
        waitlistEntry: true,
        showSeat: { include: { seat: { include: { category: true } } } },
      },
    });

    if (!offer) throw AppError.notFound('Offer not found');
    if (offer.waitlistEntry.userId !== userId) throw AppError.forbidden('Not authorized for this offer');
    if (offer.status !== 'PENDING') throw AppError.badRequest('Offer is no longer valid');
    if (new Date() > offer.expiresAt) throw AppError.badRequest('Offer has expired');

    const showSeat = offer.showSeat;
    if (showSeat.status !== 'HELD' || showSeat.heldByUserId !== offer.waitlistEntry.userId) {
       throw AppError.badRequest('Seat is no longer held for this offer');
    }

    // 2. Mark offer as accepted atomically (optimistic concurrency check)
    const updatedOffer = await tx.waitlistOffer.updateMany({
      where: { id: offer.id, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });

    if (updatedOffer.count === 0) {
      throw AppError.conflict('Offer was accepted or expired by another request');
    }

    const pricing = await tx.showSeatPricing.findUnique({
      where: { showId_categoryId: { showId: showSeat.showId, categoryId: showSeat.seat.categoryId } },
    });

    const totalAmount = pricing?.price || 0;
    // Create booking
    const booking = await tx.booking.create({
      data: {
        bookingRef,
        userId,
        showId: showSeat.showId,
        status: 'CONFIRMED',
        totalAmount,
        seats: { create: { showSeatId: showSeat.id } },
      },
    });

    // Update seat to BOOKED
    await tx.showSeat.update({
      where: { id: showSeat.id },
      data: {
        status: 'BOOKED',
        heldByUserId: null,
        heldAt: null,
        holdExpiresAt: null,
      },
    });

    // Mark waitlist entry as fulfilled
    await tx.waitlistEntry.update({
      where: { id: offer.waitlistEntryId },
      data: { status: 'FULFILLED' },
    });

    // Remove the offer expiry job from queue
    const queue = getReleaseHoldQueue();
    // Job will fire but find seat already BOOKED and do nothing

    // Add metadata for returning outside the transaction
    return {
      id: booking.id,
      bookingRef: booking.bookingRef,
      totalAmount,
      showSeat
    };
  });

  return {
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    totalAmount: booking.totalAmount,
    seat: {
      rowLabel: booking.showSeat.seat.rowLabel,
      seatNumber: booking.showSeat.seat.seatNumber,
      categoryName: booking.showSeat.seat.category.name,
    },
  };
}

export async function cancelBookingAndTriggerWaitlist(bookingId: string, userId: string): Promise<{
  cancelled: boolean;
  waitlistTriggered: boolean;
  offeredSeat?: { rowLabel: string; seatNumber: number; categoryName: string };
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seats: { include: { showSeat: { include: { seat: { include: { category: true } } } } } } },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  if (booking.userId !== userId) {
    throw AppError.forbidden('Not authorized to cancel this booking');
  }

  if (booking.status === 'CANCELLED') {
    throw AppError.badRequest('Booking already cancelled');
  }

  const showId = booking.showId;
  const showSeatIds = booking.seats.map((s: any) => s.showSeatId);

  // 1. Cancel the booking and release seats FIRST
  await prisma.$transaction(async (tx: any) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    await tx.showSeat.updateMany({
      where: { id: { in: showSeatIds } },
      data: {
        status: 'AVAILABLE',
        heldByUserId: null,
        heldAt: null,
        holdExpiresAt: null,
      },
    });

    await tx.bookingSeat.deleteMany({ where: { bookingId } });
  });

  // 2. ONLY AFTER cancellation succeeds, trigger waitlist allocation for the released seats
  let waitlistTriggered = false;
  let offeredSeat: { rowLabel: string; seatNumber: number; categoryName: string } | undefined;

  for (const showSeatId of showSeatIds) {
    const triggered = await triggerWaitlistForSeat(showSeatId);
    if (triggered && !waitlistTriggered) {
      waitlistTriggered = true;
      offeredSeat = triggered;
    }
  }

  return { cancelled: true, waitlistTriggered, offeredSeat };
}

async function triggerWaitlistForSeat(showSeatId: string): Promise<{ rowLabel: string; seatNumber: number; categoryName: string } | null> {
  const showSeat = await prisma.showSeat.findUnique({
    where: { id: showSeatId },
    include: { seat: { include: { category: true } }, show: true },
  });

  if (!showSeat) return null;

  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    let nextEntry: any = null;
    let offerToken = uuidv4();
    let expiresAt = new Date(Date.now() + OFFER_TTL_MS);

    try {
      await prisma.$transaction(async (tx: any) => {
        // Find the next waiting entry for this category
        nextEntry = await tx.waitlistEntry.findFirst({
          where: {
            showId: showSeat.showId,
            categoryId: showSeat.seat.categoryId,
            status: 'WAITING',
          },
          orderBy: { position: 'asc' },
          include: { user: true, category: true },
        });

        if (!nextEntry) {
          return; // No one waiting, seat becomes available (already handled by caller)
        }

        // Atomically claim the waitlist entry
        const updateResult = await tx.waitlistEntry.updateMany({
          where: { id: nextEntry.id, status: 'WAITING' },
          data: { status: 'OFFERED' },
        });

        if (updateResult.count === 0) {
          throw new Error('CONCURRENCY_CONFLICT'); // Entry was taken, retry
        }

        // Atomically claim the seat (ensure it's still available)
        const seatUpdateResult = await tx.showSeat.updateMany({
          where: { id: showSeatId, status: 'AVAILABLE' },
          data: {
            status: 'HELD',
            heldByUserId: nextEntry.userId,
            heldAt: new Date(),
            holdExpiresAt: expiresAt,
          },
        });

        if (seatUpdateResult.count === 0) {
           // Seat is no longer available! Another process claimed this specific seat.
           throw new Error('SEAT_ALREADY_CLAIMED');
        }

        // Create waitlist offer
        await tx.waitlistOffer.create({
          data: {
            waitlistEntryId: nextEntry.id,
            showSeatId,
            offerToken,
            expiresAt,
            status: 'PENDING',
          },
        });
      });

      if (!nextEntry) {
        return null;
      }

      // Success!
      
      // Enqueue delayed job to expire offer
      const queue = getReleaseHoldQueue();
      await queue.add(
        'expire-offer',
        { offerToken, showSeatId, waitlistEntryId: nextEntry.id },
        { delay: OFFER_TTL_MS, jobId: `offer-${offerToken}`, removeOnComplete: true, removeOnFail: false }
      );

      // Send waitlist offer email (non-blocking)
      const event = await prisma.event.findUnique({
        where: { id: showSeat.show.eventId },
        select: { title: true, type: true, venue: { select: { name: true, address: true } } },
      });

      if (event) {
        const offerUrl = `${config.appUrl}/waitlist/${offerToken}`;
        sendWaitlistOfferEmail({
          offerToken,
          userName: nextEntry.user.name,
          userEmail: nextEntry.user.email,
          eventTitle: event.title,
          eventType: event.type,
          venueName: event.venue.name,
          venueAddress: event.venue.address,
          showDate: showSeat.show.date,
          showTime: showSeat.show.time,
          seat: {
            rowLabel: showSeat.seat.rowLabel,
            seatNumber: showSeat.seat.seatNumber,
            categoryName: showSeat.seat.category.name,
          },
          expiresAt,
          offerUrl,
        }).catch((err) => console.error('Failed to send waitlist offer email:', err));
      }

      return {
        rowLabel: showSeat.seat.rowLabel,
        seatNumber: showSeat.seat.seatNumber,
        categoryName: showSeat.seat.category.name,
      };

    } catch (error: any) {
      if (error.message === 'CONCURRENCY_CONFLICT') {
        continue; // Retry loop to grab the next entry
      }
      if (error.message === 'SEAT_ALREADY_CLAIMED') {
        return null; // This seat is gone
      }
      throw error;
    }
  }
  return null;
}

export async function expireWaitlistOffer(offerToken: string): Promise<void> {
  const offer = await prisma.waitlistOffer.findUnique({
    where: { offerToken },
    include: { waitlistEntry: true, showSeat: true },
  });

  if (!offer || offer.status !== 'PENDING') {
    return; // Already processed
  }

  const showSeatId = offer.showSeatId;
  const waitlistEntryId = offer.waitlistEntryId;

  await prisma.$transaction(async (tx: any) => {
    // Release the seat
    await tx.showSeat.update({
      where: { id: showSeatId },
      data: {
        status: 'AVAILABLE',
        heldByUserId: null,
        heldAt: null,
        holdExpiresAt: null,
      },
    });

    // Mark offer as expired
    await tx.waitlistOffer.update({
      where: { id: offer.id },
      data: { status: 'EXPIRED' },
    });

    // Mark waitlist entry as expired
    await tx.waitlistEntry.update({
      where: { id: waitlistEntryId },
      data: { status: 'EXPIRED' },
    });

    // Cascade: find next waiting entry and offer them the seat
    const showSeat = await tx.showSeat.findUnique({ where: { id: showSeatId } });
    if (showSeat) {
      const nextEntry = await tx.waitlistEntry.findFirst({
        where: {
          showId: showSeat.showId,
          categoryId: showSeat.seat.categoryId,
          status: 'WAITING',
        },
        orderBy: { position: 'asc' },
        include: { user: true },
      });

      if (nextEntry) {
        // Create new offer for next in line
        const newOfferToken = uuidv4();
        const newExpiresAt = new Date(Date.now() + OFFER_TTL_MS);

        await tx.showSeat.update({
          where: { id: showSeatId },
          data: {
            status: 'HELD',
            heldByUserId: nextEntry.userId,
            heldAt: new Date(),
            holdExpiresAt: newExpiresAt,
          },
        });

        await tx.waitlistOffer.create({
          data: {
            waitlistEntryId: nextEntry.id,
            showSeatId,
            offerToken: newOfferToken,
            expiresAt: newExpiresAt,
            status: 'PENDING',
          },
        });

        await tx.waitlistEntry.update({
          where: { id: nextEntry.id },
          data: { status: 'OFFERED' },
        });

        // Enqueue new expiry job
        const queue = getReleaseHoldQueue();
        await queue.add(
          'expire-offer',
          { offerToken: newOfferToken, showSeatId, waitlistEntryId: nextEntry.id },
          { delay: OFFER_TTL_MS, jobId: `offer-${newOfferToken}`, removeOnComplete: true, removeOnFail: false }
        );

        // TODO: Send email to nextEntry.user.email
      }
    }
  });
}