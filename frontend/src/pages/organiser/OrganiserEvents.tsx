import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Ticket } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  type: 'MOVIE' | 'CONCERT';
  venue: {
    name: string;
  };
  shows?: any[];
}

interface Venue {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  baseLabel: string;
}

export function OrganiserEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create Event Form State
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'MOVIE' | 'CONCERT'>('CONCERT');
  const [venueId, setVenueId] = useState('');

  // Show & Pricing State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEvents = async () => {
    try {
      const data = await api.get<Event[]>('/events/organiser/events');
      setEvents(data);
    } catch (error) {
      toast.error('Failed to load events');
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        await fetchEvents();
        const venueData = await api.get<{ venues: Venue[] }>('/venues');
        setVenues(venueData.venues || []);
        if (venueData.venues && venueData.venues.length > 0) {
          setVenueId(venueData.venues[0].id);
        }
      } catch (error) {
        toast.error('Failed to load required data');
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Fetch categories when venue changes
  useEffect(() => {
    async function fetchCategories() {
      if (!venueId) {
        setCategories([]);
        setPrices({});
        return;
      }
      try {
        const catData = await api.get<Category[]>(`/venues/${venueId}/categories`);
        setCategories(catData || []);
        // Reset prices for the new categories
        const initialPrices: Record<string, number> = {};
        (catData || []).forEach(c => initialPrices[c.id] = 0);
        setPrices(initialPrices);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    }
    fetchCategories();
  }, [venueId]);

  // Form Errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleApiError = (error: any) => {
    if (error.details) {
      const errors: Record<string, string> = {};
      Object.entries(error.details).forEach(([key, messages]) => {
        const field = key.replace('body.', '');
        errors[field] = Array.isArray(messages) ? messages[0] : (messages as string);
      });
      setFormErrors(errors);
    } else {
      toast.error(error.message || 'Action failed');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    if (!venueId) {
      toast.error('Please select a venue');
      return;
    }
    if (!date || !time) {
      toast.error('Please provide a date and time for the first show');
      return;
    }
    
    // Validate prices
    const missingPrice = categories.some(c => !prices[c.id] || prices[c.id] <= 0);
    if (missingPrice) {
      toast.error('Please set a valid price for all seat categories');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Event
      const eventResponse = await api.post<{ id: string }>('/events', { 
        title, 
        description, 
        type, 
        venueId 
      });
      const eventId = eventResponse.id;

      // 2. Create Show
      const isoDate = new Date(date).toISOString();
      const showResponse = await api.post<{ id: string }>(`/events/${eventId}/shows`, {
        eventId,
        date: isoDate,
        time
      });
      const showId = showResponse.id;

      // 3. Set Bulk Pricing
      const pricingPayload = categories.map(c => ({
        categoryId: c.id,
        price: Math.round(prices[c.id] * 100) // Convert to cents
      }));
      await api.post(`/shows/${showId}/pricing/bulk`, { pricing: pricingPayload });

      toast.success('Event, show, and pricing created successfully!');
      
      // Reset form and reload list
      setIsCreating(false);
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      fetchEvents();
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-accent-marquee border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">My Events</h1>
          <p className="text-text-muted mt-1">Manage your events and schedule shows.</p>
        </div>
        <button onClick={() => setIsCreating(!isCreating)} className="btn-primary">
          {isCreating ? 'Cancel' : 'Create Event'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateEvent} className="card p-6 border-2 border-surface-highlight animate-fade-in space-y-8">
          
          {/* Section 1: Event Details */}
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-surface-highlight pb-2">1. Event Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Event Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                  placeholder="e.g. The Eras Tour"
                />
                {formErrors.title && <p className="text-state-error text-xs mt-1">{formErrors.title}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Event Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as 'MOVIE' | 'CONCERT')}
                  className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                >
                  <option value="CONCERT">Concert</option>
                  <option value="MOVIE">Movie</option>
                </select>
                {formErrors.type && <p className="text-state-error text-xs mt-1">{formErrors.type}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-2">Venue</label>
                <select
                  required
                  value={venueId}
                  onChange={e => setVenueId(e.target.value)}
                  className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                >
                  {venues.length === 0 && <option value="">No venues available</option>}
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {formErrors.venueId && <p className="text-state-error text-xs mt-1">{formErrors.venueId}</p>}
                {venues.length === 0 && (
                  <p className="text-xs text-state-error mt-2">
                    No venues exist. An Admin must create a venue first.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-2">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                  placeholder="Brief details about the event..."
                />
                {formErrors.description && <p className="text-state-error text-xs mt-1">{formErrors.description}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Show Timing */}
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-surface-highlight pb-2">2. Initial Showtime</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                />
                {formErrors.date && <p className="text-state-error text-xs mt-1">{formErrors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Time (HH:MM)</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-3 focus:outline-none focus:border-accent-marquee transition-colors"
                />
                {formErrors.time && <p className="text-state-error text-xs mt-1">{formErrors.time}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Pricing */}
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-4 border-b border-surface-highlight pb-2">3. Ticket Pricing</h2>
            
            {categories.length === 0 ? (
              <p className="text-sm text-text-muted italic">Select a venue first to see its seat categories.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-bg-night p-4 rounded-2xl border border-surface-highlight">
                    <label className="block text-sm font-medium text-text-muted mb-2">{cat.name} Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">₹</span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        value={prices[cat.id] || ''}
                        onChange={e => setPrices(prev => ({ ...prev, [cat.id]: parseFloat(e.target.value) }))}
                        className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl pl-8 pr-4 py-2 focus:outline-none focus:border-accent-marquee transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              className="btn-primary w-full md:w-auto" 
              disabled={!venueId || categories.length === 0 || isSubmitting}
            >
              {isSubmitting ? 'Publishing...' : 'Create & Publish Event'}
            </button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="card text-center py-16 border-dashed">
          <p className="text-text-muted mb-4">You haven't created any events yet.</p>
          <button onClick={() => setIsCreating(true)} className="text-accent-marquee hover:underline font-medium">
            Create your first event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <Link 
              key={event.id} 
              to={`/organiser/events/${event.id}`}
              className="card p-6 block hover:-translate-y-1 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full ${
                  event.type === 'CONCERT' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'
                }`}>
                  {event.type}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary group-hover:text-accent-marquee transition-colors line-clamp-1 mb-2">
                {event.title}
              </h3>
              <div className="text-sm text-text-muted space-y-1">
                <p className="flex items-center gap-1.5"><MapPin size={16} /> {event.venue.name}</p>
                <p className="flex items-center gap-1.5"><Ticket size={16} /> {event.shows?.length || 0} Show(s) Scheduled</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}