import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === '1') {
      toast.error('Your session expired, please log in again');
      // Clean up the URL
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await api.post<{ user: any; token: string }>('/auth/login', data);
      setAuth(result.user, result.token);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: any) {
      if (error.details) {
        Object.entries(error.details).forEach(([key, messages]) => {
          const field = key.replace('body.', '') as keyof LoginForm;
          const msg = Array.isArray(messages) ? messages[0] : (messages as string);
          setError(field, { type: 'server', message: msg });
        });
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-2 font-display text-2xl font-bold mb-8">
            <span className="bg-gradient-to-r from-accent-warm to-accent-primary text-transparent bg-clip-text">Click</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Welcome back</h1>
          <p className="text-text-muted">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <p id="password-error" className="mt-1.5 text-sm text-accent-stage" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent-marquee hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}