import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../utils/redis';
import { prisma } from '../utils/prisma';
import { releaseHold } from '../modules/shows/shows.service';
import { config } from '../config';

const QUEUE_NAME = 'release-hold';

export function startReleaseHoldWorker(): Worker {
  const redis = getRedisClient();

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { showSeatIds, userId, holdId } = job.data as {
        showSeatIds: string[];
        userId: string;
        holdId: string;
      };

      console.log(`[release-hold] Processing job ${holdId} for ${showSeatIds.length} seats`);

      try {
        await releaseHold(showSeatIds, userId);
        console.log(`[release-hold] Successfully released hold ${holdId}`);
      } catch (error) {
        console.error(`[release-hold] Failed to release hold ${holdId}:`, error);
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
    console.log(`[release-hold] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[release-hold] Job ${job?.id} failed:`, err);
  });

  worker.on('error', (err) => {
    console.error('[release-hold] Worker error:', err);
  });

  console.log('[release-hold] Worker started');
  return worker;
}

// Start worker if this file is run directly
if (require.main === module) {
  startReleaseHoldWorker();
}