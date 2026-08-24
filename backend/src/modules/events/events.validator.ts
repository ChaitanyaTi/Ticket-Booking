import { z } from 'zod';

export const eventQuerySchema = z.object({
  query: z.object({
    type: z.enum(['MOVIE', 'CONCERT']).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
  }),
});

export const eventIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    type: z.enum(['MOVIE', 'CONCERT']),
    venueId: z.string().cuid(),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    type: z.enum(['MOVIE', 'CONCERT']).optional(),
    venueId: z.string().cuid().optional(),
  }),
});

export const createShowSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
    date: z.string().datetime(),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
  }),
});

export const showIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export type EventQuery = z.infer<typeof eventQuerySchema>['query'];
export type EventIdParam = z.infer<typeof eventIdParamSchema>['params'];
export type CreateEventInput = z.infer<typeof createEventSchema>['body'];
export type UpdateEventInput = z.infer<typeof updateEventSchema>['body'];
export type CreateShowInput = z.infer<typeof createShowSchema>['body'];
export type ShowIdParam = z.infer<typeof showIdParamSchema>['params'];