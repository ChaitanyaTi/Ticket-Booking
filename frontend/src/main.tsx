import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        theme="light"
        richColors
        duration={4000}
        className="font-body"
        toastOptions={{
          className: 'bg-surface border border-surface/50 text-text-primary shadow-sm',
          success: {
            iconTheme: {
              primary: '#22C55E',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#FF6B4A',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);