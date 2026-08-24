import { useAuthStore } from '../../store/authStore';

export function OrganiserDashboard() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary">Organiser Dashboard</h1>
        <p className="text-text-muted mt-1">Welcome, {user?.name}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <h3 className="font-display text-lg font-bold mb-2">Total Events</h3>
          <p className="text-4xl font-bold font-mono text-accent-marquee">0</p>
        </div>
        <div className="card">
          <h3 className="font-display text-lg font-bold mb-2">Total Bookings</h3>
          <p className="text-4xl font-bold font-mono text-state-available">0</p>
        </div>
        <div className="card">
          <h3 className="font-display text-lg font-bold mb-2">Revenue</h3>
          <p className="text-4xl font-bold font-mono text-text-primary">₹0</p>
        </div>
      </div>
      <div className="mt-8 card">
        <p className="text-text-muted">Dashboard with charts coming soon...</p>
      </div>
    </div>
  );
}