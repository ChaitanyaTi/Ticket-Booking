import { z } from 'zod';

export const joinWaitlistSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    categoryId: z.string().cuid(),
  }),
});

export const waitlistIdParamSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
});

export const acceptOfferSchema = z.object({
  params: z.object({ token: z.string().min(1) }),
});

export const offerTokenParamSchema = z.object({
  params: z.object({ token: z.string().min(1) }),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>['body'];
export type WaitlistIdParam = z.infer<typeof waitlistIdParamSchema>['params'];
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>['params'];
export type OfferTokenParam = z.infer<typeof offerTokenParamSchema>['params'];