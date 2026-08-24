import { z } from 'zod';

export const venueQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
  }),
});

export const venueIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const createVenueSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
  }),
});

export const updateVenueSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
  }),
});

export const createSeatCategorySchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    name: z.string().min(1).max(50),
    baseLabel: z.string().min(1).max(5),
  }),
});

export const updateSeatCategorySchema = z.object({
  params: z.object({ 
    id: z.string().cuid(),
    categoryId: z.string().cuid()
  }),
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    baseLabel: z.string().min(1).max(5).optional(),
  }),
});

export const bulkSeatsSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    categoryId: z.string().cuid(),
    rows: z.array(z.object({
      rowLabel: z.string().min(1).max(5),
      seatCount: z.number().int().positive().max(100),
      startX: z.number().int().default(0),
      startY: z.number().int().default(0),
      xStep: z.number().int().default(1),
      yStep: z.number().int().default(1),
    })).min(1),
  }),
});

export const generateGridSeatsSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    categoryId: z.string().cuid(),
    rows: z.number().int().positive().max(50),
    seatsPerRow: z.number().int().positive().max(50),
    startX: z.number().int().default(0),
    startY: z.number().int().default(0),
    xSpacing: z.number().int().default(1),
    ySpacing: z.number().int().default(1),
    rowLabels: z.array(z.string().min(1).max(5)).optional(),
  }),
});

export type VenueQuery = z.infer<typeof venueQuerySchema>['query'];
export type VenueIdParam = z.infer<typeof venueIdParamSchema>['params'];
export type CreateVenueInput = z.infer<typeof createVenueSchema>['body'];
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>['body'];
export type CreateSeatCategoryInput = z.infer<typeof createSeatCategorySchema>['body'];
export type BulkSeatsInput = z.infer<typeof bulkSeatsSchema>['body'];
export type GenerateGridSeatsInput = z.infer<typeof generateGridSeatsSchema>['body'];