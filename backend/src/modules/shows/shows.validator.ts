import { z } from 'zod';

export const createShowSchema = z.object({
  body: z.object({
    eventId: z.string().min(1),
    date: z.string().datetime(),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
  }),
});

export const showIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const seatMapQuerySchema = z.object({
  query: z.object({
    categoryId: z.string().min(1).optional(),
  }),
});

export const holdSeatsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    seatIds: z.array(z.string().min(1)).min(1, 'At least one seat required').max(10, 'Maximum 10 seats per hold'),
  }),
});

export const releaseHoldSchema = z.object({
  params: z.object({
    holdId: z.string().min(1),
  }),
});

export const pricingSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    categoryId: z.string().min(1),
    price: z.number().int().positive('Price must be a positive integer (in smallest currency unit)'),
  }),
});

export const bulkPricingSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    pricing: z.array(z.object({
      categoryId: z.string().min(1),
      price: z.number().int().positive(),
    })).min(1),
  }),
});

export type CreateShowInput = z.infer<typeof createShowSchema>['body'];
export type ShowIdParam = z.infer<typeof showIdParamSchema>['params'];
export type SeatMapQuery = z.infer<typeof seatMapQuerySchema>['query'];
export type HoldSeatsInput = z.infer<typeof holdSeatsSchema>['body'];
export type ReleaseHoldParam = z.infer<typeof releaseHoldSchema>['params'];
export type PricingInput = z.infer<typeof pricingSchema>['body'];
export type BulkPricingInput = z.infer<typeof bulkPricingSchema>['body'];