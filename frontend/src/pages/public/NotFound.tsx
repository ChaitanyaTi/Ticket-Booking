import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
      <h1 className="font-display text-8xl font-bold text-accent-marquee mb-2">404</h1>
      <h2 className="font-display text-3xl font-bold text-text-primary mb-4">Page Not Found</h2>
      <p className="text-text-muted mb-8 max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn-primary">
        Return to Home
      </Link>
    </div>
  );
}
