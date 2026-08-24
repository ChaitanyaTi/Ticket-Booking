import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';

interface Seat {
  id: string;
  label: string;
  category: string;
}

interface Booking {
  id: string;
  bookingRef: string;
  status: 'CONFIRMED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  eventTitle: string;
  eventType: string;
  venueName: string;
  showDate: string;
  showTime: string;
  seats: Seat[];
  qrCodeUrl: string;
}

export function BookingHistory() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for cancellation flow
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  // State for QR code modal
  const [viewingTicket, setViewingTicket] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    try {
      const data = await api.get<Booking[]>('/bookings/me');
      setBookings(data);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (id: string) => {
    try {
      await api.delete(`/bookings/${id}`);
      toast.success('Booking cancelled. If there was a waitlist, the next person will be notified.');
      
      // Update local state without hard refresh
      setBookings(prev => 
        prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b)
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
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
    <div className="max-w-4xl mx-auto space-y-8 relative">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary">My Bookings</h1>
        <p className="text-text-muted mt-1">View and manage your past and upcoming events.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="card text-center py-16 border-dashed">
          <p className="text-text-muted mb-4">You have no bookings yet.</p>
          <Link to="/" className="text-accent-marquee hover:underline font-medium">
            Browse upcoming events
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map(booking => (
            <div key={booking.id} className="card p-6 flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden group border border-surface-highlight">
              
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full ${
                    booking.eventType === 'CONCERT' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'
                  }`}>
                    {booking.eventType}
                  </span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full ${
                    booking.status === 'CONFIRMED' ? 'bg-state-available/20 text-state-available' : 'bg-state-error/20 text-state-error'
                  }`}>
                    {booking.status}
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    REF: {booking.bookingRef}
                  </span>
                </div>
                
                <h3 className="font-display text-2xl font-bold text-text-primary mb-1">
                  {booking.eventTitle}
                </h3>
                <p className="text-text-muted mb-4">
                  📍 {booking.venueName}
                </p>

                <div className="grid grid-cols-2 gap-4 text-sm mt-auto pt-4 border-t border-surface-highlight">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Date & Time</p>
                    <p className="font-medium text-text-primary">
                      {new Date(booking.showDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="font-mono text-text-muted">{booking.showTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Seats ({booking.seats.length})</p>
                    <p className="font-medium text-text-primary truncate">
                      {booking.seats.map(s => s.label).join(', ')}
                    </p>
                    <p className="text-text-muted truncate">
                      {Array.from(new Set(booking.seats.map(s => s.category))).join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between md:border-l md:border-surface-highlight md:pl-6 pt-4 md:pt-0 border-t md:border-t-0 border-surface-highlight shrink-0">
                <div className="text-left md:text-right mb-6">
                  <p className="text-xs text-text-muted mb-1">Total Amount</p>
                  <p className="font-display text-2xl font-bold text-text-primary">
                    ${(booking.totalAmount / 100).toFixed(2)}
                  </p>
                </div>
                
                {booking.status === 'CONFIRMED' && (
                  <div className="flex flex-col gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => setViewingTicket(booking)}
                      className="btn-primary w-full md:w-auto text-center justify-center whitespace-nowrap"
                    >
                      View Ticket
                    </button>
                    
                    {cancellingId === booking.id ? (
                      <button 
                        onClick={() => handleCancelBooking(booking.id)}
                        className="bg-state-error/10 hover:bg-state-error/20 text-state-error border border-state-error/20 font-medium px-4 py-2 rounded-2xl transition-colors text-sm text-center"
                      >
                        Are you sure? Click to confirm.
                      </button>
                    ) : (
                      <button 
                        onClick={() => setCancellingId(booking.id)}
                        className="text-state-error hover:underline text-sm font-medium text-center"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Ticket QR Modal */}
      {viewingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-night/90 p-4 animate-fade-in backdrop-blur-sm">
          <div className="card w-full max-w-md p-8 relative flex flex-col items-center text-center">
            <button 
              onClick={() => setViewingTicket(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-2xl"
            >
              &times;
            </button>
            
            <h2 className="text-xl font-bold text-text-primary mb-2">
              {viewingTicket.eventTitle}
            </h2>
            <p className="text-text-muted mb-8 text-sm">
              {new Date(viewingTicket.showDate).toLocaleDateString()} at {viewingTicket.showTime}
            </p>
            
            <div className="bg-white p-4 rounded-2xl mb-6 shadow-sm">
              <QRCodeCanvas 
                value={JSON.stringify({ bookingRef: viewingTicket.bookingRef, type: 'booking' })} 
                size={192} 
                fgColor="#0F1225"
                bgColor="#FFB627"
                level="Q"
              />
            </div>

            <p className="font-mono text-sm tracking-widest text-text-primary">
              {viewingTicket.bookingRef}
            </p>
            <p className="text-xs text-text-muted mt-2 max-w-xs">
              Present this QR code at the venue entrance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}