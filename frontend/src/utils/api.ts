import { useAuthStore } from '../store/authStore';

const API_BASE = import.meta.env.PROD ? 'https://ticket-booking-backend-3v95.onrender.com/api' : '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { token } = useAuthStore.getState();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    throw new ApiError(
      data.error?.message || 'Request failed',
      response.status,
      data.error?.code || 'ERROR',
      data.error?.details
    );
  }

  return data.data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  patch: <T>(endpoint: string, body: unknown) => request<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  delete: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { 
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {})
  }),
};

export { ApiError };