import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  listVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
  createSeatCategory,
  updateSeatCategory,
  deleteSeatCategory,
  getSeatCategories,
  bulkCreateSeats,
  generateGridSeats,
  getVenueSeats,
} from './venues.service';
import { AppError } from '../../utils/errors';

export async function listVenuesController(req: Request, res: Response): Promise<void> {
  const { page, limit } = req.query as { page?: string; limit?: string };
  const result = await listVenues({
    page: parseInt(page || '1', 10),
    limit: parseInt(limit || '20', 10),
  });
  res.json({ success: true, data: result });
}

export async function getVenueController(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const venue = await getVenueById(id);
  res.json({ success: true, data: venue });
}

export async function createVenueController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can create venues');
  }

  const venue = await createVenue(user.id, req.body);
  res.status(201).json({ success: true, data: venue });
}

export async function updateVenueController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can update venues');
  }

  const { id } = req.params;
  const venue = await updateVenue(id, req.body);
  res.json({ success: true, data: venue });
}

export async function deleteVenueController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can delete venues');
  }

  const { id } = req.params;
  await deleteVenue(id);
  res.json({ success: true, data: { message: 'Venue deleted' } });
}

export async function createSeatCategoryController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can create seat categories');
  }

  const { id } = req.params;
  const category = await createSeatCategory(id, req.body);
  res.status(201).json({ success: true, data: category });
}

export async function updateSeatCategoryController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can update seat categories');
  }

  const { categoryId } = req.params;
  const category = await updateSeatCategory(categoryId, req.body);
  res.json({ success: true, data: category });
}

export async function deleteSeatCategoryController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can delete seat categories');
  }

  const { categoryId } = req.params;
  await deleteSeatCategory(categoryId);
  res.json({ success: true, data: { message: 'Category deleted' } });
}

export async function getSeatCategoriesController(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const categories = await getSeatCategories(id);
  res.json({ success: true, data: categories });
}

export async function bulkCreateSeatsController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can create seats');
  }

  const { id } = req.params;
  const { categoryId, rows } = req.body;
  const result = await bulkCreateSeats(id, categoryId, rows);
  res.status(201).json({ success: true, data: result });
}

export async function generateGridSeatsController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can generate seats');
  }

  const { id } = req.params;
  const result = await generateGridSeats(id, req.body.categoryId, req.body);
  res.status(201).json({ success: true, data: result });
}

export async function getVenueSeatsController(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { categoryId } = req.query;
  const seats = await getVenueSeats(id, categoryId as string | undefined);
  res.json({ success: true, data: seats });
}