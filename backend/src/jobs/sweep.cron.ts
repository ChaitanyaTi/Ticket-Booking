import { prisma } from '../utils/prisma';
import { getIo } from '../utils/socket';

const SWEEP_INTERVAL_MS = 60 * 1000; // Every minute

export async function sweepExpiredHolds(): Promise<number> {
  const now = new Date();

  // Find all held seats that have expired
  const expiredSeats = await prisma.showSeat.findMany({
    where: {
      status: 'HELD',
      holdExpiresAt: { lt: now },
    },
    select: { id: true, heldByUserId: true, showId: true, seatId: true },
  });

  if (expiredSeats.length === 0) {
    return 0;
  }

  console.log(`[sweep] Found ${expiredSeats.length} expired holds to release`);

  // Group by userId to call releaseHold efficiently
  const byUser = new Map<string, string[]>();
  for (const seat of expiredSeats) {
    if (seat.heldByUserId) {
      const arr = byUser.get(seat.heldByUserId) || [];
      arr.push(seat.id);
      byUser.set(seat.heldByUserId, arr);
    }
  }

  let released = 0;
  for (const [userId, seatIds] of byUser.entries()) {
    try {
      // Use the same release logic (will only release if still held by that user)
      await prisma.$transaction(async (tx: any) => {
        const stillHeld = await tx.showSeat.findMany({
          where: {
            id: { in: seatIds },
            status: 'HELD',
            heldByUserId: userId,
          },
        });

        if (stillHeld.length > 0) {
          await tx.showSeat.updateMany({
            where: {
              id: { in: seatIds },
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
          released += stillHeld.length;

          const io = getIo();
          stillHeld.forEach((s: any) => {
            io.to(`show:${s.showId}`).emit('seat:released', {
              seatId: s.seatId, // Wait, `stillHeld` only selects what was fetched!
            });
          });
        }
      });
    } catch (error) {
      console.error(`[sweep] Failed to release holds for user ${userId}:`, error);
    }
  }

  // Also clean up any orphaned BullMQ jobs for these seats
  // (Jobs that might still be in the queue but seats are already released/booked)
  // This is handled by the job itself checking status before releasing

  if (released > 0) {
    console.log(`[sweep] Released ${released} expired seats`);
  }

  return released;
}

export function startSweepCron(): NodeJS.Timeout {
  console.log('[sweep] Starting cron job (every 60s)');
  return setInterval(async () => {
    try {
      await sweepExpiredHolds();
    } catch (error) {
      console.error('[sweep] Cron error:', error);
    }
  }, SWEEP_INTERVAL_MS);
}

if (require.main === module) {
  startSweepCron();
  console.log('[sweep] Cron started, press Ctrl+C to stop');
  process.on('SIGINT', () => process.exit(0));
}