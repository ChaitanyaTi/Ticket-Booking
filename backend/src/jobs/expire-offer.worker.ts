import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../utils/redis';
import { expireWaitlistOffer } from '../modules/waitlist/waitlist.service';
import { config } from '../config';

const QUEUE_NAME = 'release-hold'; // Same queue as release-hold

export function startExpireOfferWorker(): Worker {
  const redis = getRedisClient();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== 'expire-offer') return; // Only handle expire-offer jobs

      const { offerToken, showSeatId, waitlistEntryId } = job.data as {
        offerToken: string;
        showSeatId: string;
        waitlistEntryId: string;
      };

      console.log(`[expire-offer] Processing job ${offerToken} for seat ${showSeatId}`);

      try {
        await expireWaitlistOffer(offerToken);
        console.log(`[expire-offer] Successfully expired offer ${offerToken}`);
      } catch (error) {
        console.error(`[expire-offer] Failed to expire offer ${offerToken}:`, error);
        throw error; // Re-throw to let BullMQ handle retry
      }
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    if (job.name === 'expire-offer') {
      console.log(`[expire-offer] Job ${job.id} completed`);
    }
  });

  worker.on('failed', (job, err) => {
    if (job?.name === 'expire-offer') {
      console.error(`[expire-offer] Job ${job?.id} failed:`, err);
    }
  });

  worker.on('error', (err) => {
    console.error('[expire-offer] Worker error:', err);
  });

  console.log('[expire-offer] Worker started');
  return worker;
}

if (require.main === module) {
  startExpireOfferWorker();
}