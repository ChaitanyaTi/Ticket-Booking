import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'sonner';

interface Show {
  id: string;
  date: string;
  time: string;
  status: string;
}

interface EventDetail {
  id: string;
  title: string;
  type: 'MOVIE' | 'CONCERT';
  description: string;
  venue: {
    id: string;
    name: string;
    address: string;
  };
  shows: Show[];
}

export function OrganiserEventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Show creation state
  const [isAddingShow, setIsAddingShow] = useState(false);
  const [showDate, setShowDate] = useState('');
  const [showTime, setShowTime] = useState('');
  const [isSubmittingShow, setIsSubmittingShow] = useState(false);

  // Edit Event state
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'MOVIE' | 'CONCERT'>('CONCERT');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Delete Event state
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchEvent = async () => {
    try {
      const data = await api.get<EventDetail>(`/events/${eventId}`);
      setEvent(data);
      setEditTitle(data.title);
      setEditType(data.type);
      setEditDescription(data.description || '');
    } catch (error) {
      toast.error('Failed to load event details');
      navigate('/organiser/events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const handleAddShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDate || !showTime) return;

    setFormErrors({});
    setIsSubmittingShow(true);
    try {
      const isoDate = new Date(showDate).toISOString();
      await api.post(`/events/${eventId}/shows`, {
        eventId,
        date: isoDate,
        time: showTime
      });
      toast.success('Show scheduled successfully!');
      
      setIsAddingShow(false);
      setShowDate('');
      setShowTime('');
      fetchEvent();
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsSubmittingShow(false);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSavingEvent(true);
    try {
      await api.patch(`/events/${eventId}`, {
        title: editTitle,
        type: editType,
        description: editDescription
      });
      toast.success('Event updated successfully!');
      setIsEditingEvent(false);
      fetchEvent();
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await api.delete(`/events/${eventId}`);
      toast.success('Event deleted successfully!');
      navigate('/organiser/events');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete event');
      setIsDeleting(false);
    }
  };

  if (isLoading || !event) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-accent-marquee border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-surface-highlight">
        <div>
          <Link to="/organiser/events" className="text-text-muted hover:text-accent-marquee text-sm mb-4 inline-flex items-center gap-1">
            &larr; Back to events
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <span className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-full ${
              event.type === 'CONCERT' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'
            }`}>
              {event.type}
            </span>
            <h1 className="font-display text-3xl font-bold text-text-primary">{event.title}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isDeleting ? (
            <button 
              onClick={handleDeleteEvent}
              className="bg-state-error/10 hover:bg-state-error/20 text-state-error border border-state-error/20 font-medium px-4 py-2 rounded-2xl transition-colors text-sm"
            >
              Are you sure? Click to confirm.
            </button>
          ) : (
            <button 
              onClick={() => setIsDeleting(true)}
              className="text-state-error hover:underline text-sm font-medium"
            >
              Delete Event
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Event Settings / Details */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="card p-6 border border-surface-highlight relative group">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">Event Details</h2>
              {!isEditingEvent && (
                <button 
                  onClick={() => setIsEditingEvent(true)}
                  className="text-accent-marquee text-sm hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            
            {isEditingEvent ? (
              <form onSubmit={handleUpdateEvent} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-surface border border-surface-highlight text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:border-accent-marquee"
                  />
                  {formErrors.title && <p className="text-state-error text-xs mt-1">{formErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Type</label>
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value as 'MOVIE' | 'CONCERT')}
                    className="w-full bg-surface border border-surface-highlight text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:border-accent-marquee"
                  >
                    <option value="CONCERT">Concert</option>
                    <option value="MOVIE">Movie</option>
                  </select>
                  {formErrors.type && <p className="text-state-error text-xs mt-1">{formErrors.type}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-surface border border-surface-highlight text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:border-accent-marquee"
                  />
                  {formErrors.description && <p className="text-state-error text-xs mt-1">{formErrors.description}</p>}
                </div>
                <div className="pt-2 flex justify-end gap-3 border-t border-surface-highlight">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingEvent(false);
                      setEditTitle(event.title);
                      setEditType(event.type);
                      setEditDescription(event.description || '');
                    }}
                    className="text-text-muted hover:text-text-primary text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary py-1.5 px-4 text-sm"
                    disabled={isSavingEvent}
                  >
                    {isSavingEvent ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-text-muted text-sm leading-relaxed">
                  {event.description || 'No description available'}
                </p>

                <div className="bg-bg-night p-4 rounded-2xl border border-surface-highlight">
                  <h3 className="text-sm font-bold text-text-primary mb-2">Venue (Locked)</h3>
                  <div className="text-sm text-text-muted">
                    <p className="font-medium text-text-primary flex items-center gap-1.5"><MapPin size={16} /> {event.venue.name}</p>
                    <p className="ml-5">{event.venue.address}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Shows Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 border-2 border-surface-highlight">
            <div className="flex justify-between items-center mb-6 border-b border-surface-highlight pb-4">
              <h2 className="text-2xl font-display font-bold text-text-primary">Showtimes</h2>
              <button 
                onClick={() => setIsAddingShow(!isAddingShow)}
                className="btn-primary py-2 px-4 text-sm"
              >
                {isAddingShow ? 'Cancel' : 'Add Show'}
              </button>
            </div>

            {isAddingShow && (
              <form onSubmit={handleAddShow} className="bg-bg-night p-6 rounded-2xl border border-surface-highlight mb-8 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">Date</label>
                    <input
                      type="date"
                      required
                      value={showDate}
                      onChange={e => setShowDate(e.target.value)}
                      className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-2 focus:outline-none focus:border-accent-marquee"
                    />
                    {formErrors.date && <p className="text-state-error text-xs mt-1">{formErrors.date}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">Time</label>
                    <input
                      type="time"
                      required
                      value={showTime}
                      onChange={e => setShowTime(e.target.value)}
                      className="w-full bg-surface border border-surface-highlight text-text-primary rounded-2xl px-4 py-2 focus:outline-none focus:border-accent-marquee"
                    />
                    {formErrors.time && <p className="text-state-error text-xs mt-1">{formErrors.time}</p>}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary" disabled={isSubmittingShow}>
                    {isSubmittingShow ? 'Scheduling...' : 'Schedule Show'}
                  </button>
                </div>
              </form>
            )}

            {event.shows.length === 0 ? (
              <div className="text-center py-12 text-text-muted border-2 border-dashed border-surface-highlight rounded-2xl">
                No upcoming shows
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {event.shows.map(show => (
                  <Link 
                    key={show.id}
                    to={`/organiser/shows/${show.id}`}
                    className="bg-bg-night p-4 rounded-2xl border border-surface-highlight hover:border-accent-marquee transition-colors group flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-text-primary text-lg">
                        {new Date(show.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-text-muted font-mono">{show.time}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full mb-2 inline-block ${
                        show.status === 'UPCOMING' ? 'bg-state-available/20 text-state-available' : 'bg-surface text-text-muted'
                      }`}>
                        {show.status}
                      </span>
                      <p className="text-xs text-accent-marquee group-hover:underline block mt-1">Manage Prices &rarr;</p>
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
