import { Outlet, Link, useLocation } from 'react-router-dom';
import { Ticket, ChevronDown, X, Menu, Home, Calendar, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';

export function Layout() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
  };

  const navLinks = [
    { path: '/', label: 'Events' },
    ...(isAuthenticated && user?.role === 'CUSTOMER' ? [{ path: '/bookings', label: 'My Bookings' }] : []),
    ...(isAuthenticated && (user?.role === 'ORGANISER' || user?.role === 'ADMIN') ? [
      { path: '/organiser', label: 'Dashboard' },
      { path: '/organiser/events', label: 'My Events' },
    ] : []),
    ...(isAuthenticated && user?.role === 'ADMIN' ? [{ path: '/admin/venues', label: 'Venues' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-bg-night/95 backdrop-blur-sm border-b border-surface/50">
        <nav className="w-full px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-display text-3xl font-bold" aria-label="Click Home">
              <span className="bg-gradient-to-r from-accent-warm to-accent-primary text-transparent bg-clip-text">Click</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-lg font-medium transition-colors duration-200 hover:text-accent-marquee ${
                    location.pathname.startsWith(link.path) && link.path !== '/'
                      ? 'text-accent-marquee'
                      : 'text-text-muted'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side - Auth or User menu */}
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-medium text-text-primary hover:bg-surface/50 transition-colors"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-expanded={mobileMenuOpen}
                    aria-haspopup="true"
                  >
                    <span className="hidden sm:block font-mono text-xs text-text-muted">#{user?.id.slice(-6)}</span>
                    <span className="font-body">{user?.name}</span>
                    <ChevronDown size={16} className="text-text-muted" />
                  </button>

                  {mobileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-surface rounded-2xl border border-surface/50 shadow-sm py-1 animate-in fade-in-0 zoom-in-95 duration-200">
                      <div className="px-4 py-2 border-b border-surface/50">
                        <p className="text-xs text-text-muted font-mono truncate" title={user?.email}>{user?.email}</p>
                        <p className="text-xs text-accent-marquee font-medium capitalize">{user?.role.toLowerCase()}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface/50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn-ghost text-sm">
                    Login
                  </Link>
                  <Link to="/register" className="btn-primary text-sm">
                    Sign Up
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 rounded-2xl text-text-muted hover:bg-surface/50 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                  {mobileMenuOpen ? (
                    <X size={24} />
                  ) : (
                    <Menu size={24} />
                  )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-surface/50 animate-in slide-in-from-top-2 duration-200">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-2xl text-base font-medium transition-colors ${
                      location.pathname.startsWith(link.path) && link.path !== '/'
                        ? 'bg-accent-marquee/10 text-accent-marquee'
                        : 'text-text-muted hover:bg-surface/50 hover:text-text-primary'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-4 pb-20 md:pt-16 md:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-fade-slide-up" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface/50 py-8 hidden md:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-text-muted">
          <p>Click — one click away</p>
        </div>
      </footer>

      {/* Bottom Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-surface/50">
        <div className="flex items-center justify-around h-16 px-2">
          <Link to="/" className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${location.pathname === '/' ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}`}>
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to={user?.role === 'ORGANISER' ? '/organiser/events' : '/'} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${(location.pathname.includes('/events') || location.pathname === '/organiser') ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}`}>
            <Calendar size={20} />
            <span className="text-[10px] font-medium">Events</span>
          </Link>
          <Link to="/bookings" className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${location.pathname.includes('/bookings') ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}`}>
            <Ticket size={20} />
            <span className="text-[10px] font-medium">Tickets</span>
          </Link>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${mobileMenuOpen ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}`}>
            <User size={20} />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
        
        {mobileMenuOpen && (
          <div className="absolute bottom-16 right-4 w-48 bg-surface rounded-2xl border border-surface/50 shadow-sm py-2 animate-in slide-in-from-bottom-2">
             {isAuthenticated ? (
               <>
                 <div className="px-4 py-2 border-b border-surface/50 mb-2">
                   <p className="text-xs text-text-muted font-mono truncate">{user?.email}</p>
                   <p className="text-xs text-accent-primary font-medium capitalize">{user?.role?.toLowerCase()}</p>
                 </div>
                 {user?.role === 'ADMIN' && (
                   <Link to="/admin/venues" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-surface/50">Admin Venues</Link>
                 )}
                 {user?.role === 'ORGANISER' && (
                   <Link to="/organiser" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-surface/50">Dashboard</Link>
                 )}
                 <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-accent-warm hover:bg-surface/50 font-medium">Logout</button>
               </>
             ) : (
               <>
                 <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-surface/50">Login</Link>
                 <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-accent-primary hover:bg-surface/50">Sign Up</Link>
               </>
             )}
          </div>
        )}
      </nav>
    </div>
  );
}