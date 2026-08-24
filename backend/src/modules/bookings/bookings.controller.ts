import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getUserBookings } from './bookings.service';

export async function getMyBookingsController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const bookings = await getUserBookings(user.id);
  res.json({ success: true, data: bookings });
}
