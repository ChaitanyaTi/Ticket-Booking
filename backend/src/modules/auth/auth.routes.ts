import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { registerController, loginController, meController } from './auth.controller';
import { registerSchema, loginSchema } from './auth.validator';
import { validate } from '../../middleware/validate';

const router = Router();

router.post('/register', validate(registerSchema), registerController);
router.post('/login', validate(loginSchema), loginController);
router.get('/me', authenticate, meController);

export default router;