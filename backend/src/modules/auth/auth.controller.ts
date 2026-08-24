import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { register, login, getMe } from './auth.service';
import { RegisterInput, LoginInput } from './auth.validator';

export async function registerController(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterInput;
  const result = await register(input);

  res.status(201).json({
    success: true,
    data: result,
  });
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const input = req.body as LoginInput;
  const result = await login(input);

  res.json({
    success: true,
    data: result,
  });
}

export async function meController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = await getMe(req.user!.id);

  res.json({
    success: true,
    data: { user },
  });
}