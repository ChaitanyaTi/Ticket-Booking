import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, MapPin, Calendar } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';

interface Event {
  id: string;
  title: string;
  description: string | null;
  type: 'MOVIE' | 'CONCERT';
  venue: { name: string; address: string };
  shows: Array<{
    id: string;
    date: string;
    time: string;
    status: string;
  }>;
}

export function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'MOVIE' | 'CONCERT'>('all');

  useEffect(() => {
    loadEvents();
  }, []);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      const response = await api.get<any>('/events');
      console.log("API response:", response);
      if (Array.isArray(response)) {
        setEvents(response);
      } else if (response && Array.isArray(response.events)) {
        setEvents(response.events);
      } else if (response && response.data && Array.isArray(response.data.events)) {
        setEvents(response.data.events);
      } else if (response && Array.isArray(response.data)) {
        setEvents(response.data);
      } else {
        setEvents([]);
        setErrorMsg("Data structure invalid: " + JSON.stringify(response).substring(0, 100));
      }
    } catch (error: any) {
      console.error('Failed to load events:', error);
      setErrorMsg(error.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = events.filter((event) =>
    filter === 'all' ? true : event.type === filter
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-accent-marquee border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">Events</h1>
          <p className="text-text-muted mt-1">Discover movies and concerts near you</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Filter by event type">
          {(['all', 'MOVIE', 'CONCERT'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                filter === type
                  ? 'bg-accent-marquee text-bg-night'
                  : 'bg-surface text-text-muted hover:text-text-primary hover:bg-surface/80'
              }`}
              aria-pressed={filter === type}
            >
              {type === 'all' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase() + 's'}
            </button>
          ))}
        </div>
      </div>

      {errorMsg ? (
        <div className="text-center py-16 text-state-error">
          <p>Error: {errorMsg}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <Inbox size={64} className="mx-auto text-text-muted/50" />
          <h3 className="mt-4 font-display text-xl font-medium text-text-primary">No events found</h3>
          <p className="mt-2 text-text-muted">Check back later for new events</p>
          <p className="mt-2 text-xs text-text-muted/50">Debug: data returned is empty array or undefined</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const upcomingShows = event.shows
              .filter((s) => s.status === 'UPCOMING')
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const nextShow = upcomingShows[0];

            return (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="card group h-full flex flex-col"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <span className={`badge ${event.type === 'MOVIE' ? 'badge-available' : 'badge-concert'}`}>
                    {event.type}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-text-primary group-hover:text-accent-marquee transition-colors mb-2">
                  {event.title}
                </h3>

                <p className="text-text-muted text-sm mb-4 line-clamp-2 flex-1">
                  {event.description || 'No description available'}
                </p>

                <div className="space-y-2 text-sm text-text-muted">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="flex-shrink-0" />
                    <span>{event.venue.name}</span>
                  </div>

                  {nextShow && (
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="flex-shrink-0" />
                      <span>
                        {format(new Date(nextShow.date), 'MMM d, yyyy')} at {nextShow.time}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}