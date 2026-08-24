import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export function Unauthorized() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 bg-state-error/10 text-state-error rounded-full flex items-center justify-center mb-6">
        <AlertTriangle size={32} />
      </div>
      <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Not Authorized</h1>
      <p className="text-text-muted mb-8 max-w-md">
        You do not have permission to view this page. Ensure you are logged in with the correct account role.
      </p>
      <Link to="/" className="btn-primary">
        Return to Home
      </Link>
    </div>
  );
}
