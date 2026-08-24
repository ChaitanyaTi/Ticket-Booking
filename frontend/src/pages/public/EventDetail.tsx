import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, ChevronRight } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';

interface Show {
  id: string;
  date: string;
  time: string;
  status: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  type: 'MOVIE' | 'CONCERT';
  venue: { name: string; address: string };
  shows: Show[];
}

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const data = await api.get<Event>(`/events/${eventId}`);
      setEvent(data);
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const upcomingShows = event?.shows
    .filter((s) => s.status === 'UPCOMING')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-accent-marquee border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <h2 className="font-display text-2xl font-bold text-text-primary">Event not found</h2>
        <Link to="/" className="text-accent-marquee hover:underline mt-4 inline-block">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary mb-6 transition-colors">
        <ChevronLeft size={20} />
        Back to events
      </Link>

      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`badge ${event.type === 'MOVIE' ? 'badge-available' : 'badge-concert'}`}>
                {event.type}
              </span>
              <h1 className="font-display text-3xl font-bold text-text-primary">{event.title}</h1>
            </div>
            <p className="text-text-muted leading-relaxed">{event.description || 'No description available'}</p>
          </div>

          <div className="card">
            <h3 className="font-display text-lg font-bold mb-4">Venue</h3>
            <div className="space-y-2 text-text-muted">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="flex-shrink-0" />
                <span>{event.venue.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-7">
                <MapPin size={20} className="flex-shrink-0 opacity-0" />
                <span>{event.venue.address}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="font-display text-lg font-bold mb-4">Showtimes</h3>
            {upcomingShows.length === 0 ? (
              <p className="text-text-muted text-center py-4">No upcoming shows</p>
            ) : (
              <div className="space-y-3">
                {upcomingShows.map((show) => (
                  <Link
                    key={show.id}
                    to={`/shows/${show.id}/seats`}
                    className="block p-4 rounded-2xl bg-surface/50 border border-surface/50 hover:border-accent-marquee/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-text-primary">
                          {format(new Date(show.date), 'EEEE, MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-text-muted">{show.time}</p>
                      </div>
                      <ChevronRight size={20} className="text-text-muted" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}