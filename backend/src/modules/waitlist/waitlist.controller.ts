import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  joinWaitlist,
  getUserWaitlistEntries,
  getWaitlistOfferByToken,
  acceptWaitlistOffer,
  cancelBookingAndTriggerWaitlist,
  expireWaitlistOffer,
} from './waitlist.service';
import { AppError } from '../../utils/errors';

export async function joinWaitlistController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { categoryId } = req.body;
  const userId = req.user!.id;

  const entry = await joinWaitlist(id, userId, categoryId);
  res.status(201).json({ success: true, data: entry });
}

export async function getMyWaitlistController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const entries = await getUserWaitlistEntries(userId);
  res.json({ success: true, data: entries });
}

export async function getWaitlistOfferController(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const offer = await getWaitlistOfferByToken(token);

  if (!offer) {
    throw AppError.notFound('Offer not found');
  }

  res.json({ success: true, data: offer });
}

export async function acceptWaitlistOfferController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { token } = req.params;
  const userId = req.user!.id;

  const result = await acceptWaitlistOffer(token, userId);
  res.status(201).json({ success: true, data: result });
}

export async function cancelBookingController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: bookingId } = req.params;
  const userId = req.user!.id;

  const result = await cancelBookingAndTriggerWaitlist(bookingId, userId);
  res.json({ success: true, data: result });
}

// Internal: called by BullMQ worker
export async function expireOfferController(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  await expireWaitlistOffer(token);
  res.json({ success: true, data: { message: 'Offer expired and cascaded' } });
}