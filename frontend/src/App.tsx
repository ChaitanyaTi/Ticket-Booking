import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/public/Login';
import { Register } from './pages/public/Register';
import { EventsList } from './pages/public/EventsList';
import { EventDetail } from './pages/public/EventDetail';
import { SeatMap } from './pages/public/SeatMap';
import { Checkout } from './pages/public/Checkout';
import { WaitlistOffer } from './pages/public/WaitlistOffer';
import { BookingHistory } from './pages/customer/BookingHistory';
import { OrganiserDashboard } from './pages/organiser/OrganiserDashboard';
import { OrganiserEvents } from './pages/organiser/OrganiserEvents';
import { OrganiserEventDetail } from './pages/organiser/OrganiserEventDetail';
import { OrganiserShowDetail } from './pages/organiser/OrganiserShowDetail';
import { AdminVenues } from './pages/admin/AdminVenues';

import { Unauthorized } from './pages/public/Unauthorized';
import { NotFound } from './pages/public/NotFound';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role || '')) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/waitlist/:token" element={<WaitlistOffer />} />

      {/* Public pages with layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<EventsList />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/shows/:showId/seats" element={<SeatMap />} />
        <Route path="/checkout/:showId" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'ORGANISER', 'ADMIN']}><Checkout /></ProtectedRoute>} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      {/* Customer routes */}
      <Route element={<Layout />}>
        <Route path="/bookings" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'ORGANISER', 'ADMIN']}><BookingHistory /></ProtectedRoute>} />
      </Route>

      {/* Organiser routes */}
      <Route element={<Layout />}>
        <Route path="/organiser" element={<ProtectedRoute allowedRoles={['ORGANISER', 'ADMIN']}><OrganiserDashboard /></ProtectedRoute>} />
        <Route path="/organiser/events" element={<ProtectedRoute allowedRoles={['ORGANISER', 'ADMIN']}><OrganiserEvents /></ProtectedRoute>} />
        <Route path="/organiser/events/:eventId" element={<ProtectedRoute allowedRoles={['ORGANISER', 'ADMIN']}><OrganiserEventDetail /></ProtectedRoute>} />
        <Route path="/organiser/shows/:showId" element={<ProtectedRoute allowedRoles={['ORGANISER', 'ADMIN']}><OrganiserShowDetail /></ProtectedRoute>} />
      </Route>

      {/* Admin routes */}
      <Route element={<Layout />}>
        <Route path="/admin/venues" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminVenues /></ProtectedRoute>} />
      </Route>

      {/* Catch-all */}
      <Route element={<Layout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}