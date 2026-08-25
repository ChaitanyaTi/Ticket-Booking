import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').regex(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, 'Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['CUSTOMER', 'ORGANISER']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: 'CUSTOMER' },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const result = await api.post<{ user: any; token: string }>('/auth/register', payload);
      setAuth(result.user, result.token);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (error: any) {
      if (error.details) {
        Object.entries(error.details).forEach(([key, messages]) => {
          const field = key.replace('body.', '') as keyof RegisterForm;
          const msg = Array.isArray(messages) ? messages[0] : (messages as string);
          setError(field, { type: 'server', message: msg });
        });
      } else {
        toast.error(error.message || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-2 font-display text-2xl font-bold mb-8">
            <span className="bg-gradient-to-r from-accent-warm to-accent-primary text-transparent bg-clip-text">Click</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Create an account</h1>
          <p className="text-text-muted">Start booking tickets in seconds</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="name" className="label">Full Name</label>
            <input
              {...register('name')}
              id="name"
              type="text"
              className="input"
              placeholder="John Doe"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="mt-1.5 text-sm text-accent-stage" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              {...register('email')}
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="mt-1.5 text-sm text-accent-stage" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              {...register('password')}
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <p id="password-error" className="mt-1.5 text-sm text-accent-stage" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">Confirm Password</label>
            <input
              {...register('confirmPassword')}
              id="confirmPassword"
              type="password"
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
            />
            {errors.confirmPassword && (
              <p id="confirm-error" className="mt-1.5 text-sm text-accent-stage" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">Register as</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative cursor-pointer">
                <input
                  {...register('role')}
                  type="radio"
                  value="CUSTOMER"
                  className="sr-only peer"
                />
                <div className="peer-checked:border-accent-primary peer-checked:bg-accent-primary/10 border-2 border-transparent peer-checked:border-accent-primary rounded-2xl p-4 text-center transition-all bg-surface/50 hover:bg-surface/80">
                  <p className="font-medium text-text-primary">Customer</p>
                  <p className="text-xs text-text-muted mt-1">Book tickets</p>
                </div>
              </label>
              <label className="relative cursor-pointer">
                <input
                  {...register('role')}
                  type="radio"
                  value="ORGANISER"
                  className="sr-only peer"
                />
                <div className="peer-checked:border-accent-primary peer-checked:bg-accent-primary/10 border-2 border-transparent peer-checked:border-accent-primary rounded-2xl p-4 text-center transition-all bg-surface/50 hover:bg-surface/80">
                  <p className="font-medium text-text-primary">Organiser</p>
                  <p className="text-xs text-text-muted mt-1">Create events</p>
                </div>
              </label>
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}