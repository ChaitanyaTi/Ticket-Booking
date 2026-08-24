import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Bell } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'sonner';
import { SeatCell } from '../../components/seatmap/SeatCell';

interface WaitlistOfferResponse {
  id: string;
  waitlistEntryId: string;
  showSeatId: string;
  seat: {
    rowLabel: string;
    seatNumber: number;
    categoryName: string;
  };
  offerToken: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
}

export function WaitlistOffer() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [offer, setOffer] = useState<WaitlistOfferResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpiredLocally, setIsExpiredLocally] = useState(false);

  useEffect(() => {
    async function fetchOffer() {
      try {
        const data = await api.get<WaitlistOfferResponse>(`/waitlist-offers/${token}`);
        setOffer(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load offer');
      } finally {
        setIsLoading(false);
      }
    }
    if (token) fetchOffer();
  }, [token]);

  useEffect(() => {
    if (!offer || offer.status !== 'PENDING') return;

    const expiryTime = new Date(offer.expiresAt).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
      
      if (diff === 0) {
        setTimeLeft('00:00');
        setIsExpiredLocally(true);
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setTimeLeft(`${m}:${s}`);
      }
    }, 1000);
    
    // Initial call
    const now = Date.now();
    const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
    if (diff <= 0) {
      setTimeLeft('00:00');
      setIsExpiredLocally(true);
    } else {
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setTimeLeft(`${m}:${s}`);
    }

    return () => clearInterval(interval);
  }, [offer]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    try {
      const result = await api.post<{ bookingId: string; bookingRef: string; totalAmount: number; qrCodeUrl: string }>(
        `/waitlist-offers/${token}/accept`,
        {}
      );
      toast.success('Offer accepted and booked!');
      // Navigate to a success page or bookings page. Since we don't have a dedicated success page here,
      // we can just redirect to bookings, where they can see their new booking.
      navigate('/bookings');
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept offer');
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-accent-marquee border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle errors or already expired/taken offers gracefully
  if (error || !offer || offer.status !== 'PENDING' || isExpiredLocally) {
    let message = "This waitlist offer is no longer valid.";
    if (offer?.status === 'ACCEPTED') message = "You have already accepted this offer.";
    else if (offer?.status === 'EXPIRED' || isExpiredLocally) message = "This waitlist offer has expired and the seat was offered to the next person.";
    else if (error) message = error;

    return (
      <div className="max-w-md mx-auto text-center py-12 px-4">
        <div className="w-16 h-16 mx-auto bg-surface rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} className="text-text-muted" />
        </div>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">Offer Unavailable</h1>
        <p className="text-text-muted mb-8">{message}</p>
        <Link to="/" className="btn-primary inline-block">
          Return to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <div className="card text-center p-8 border-2 border-accent-marquee/30 bg-gradient-to-b from-surface to-bg-night">
        <div className="w-16 h-16 mx-auto bg-accent-marquee/20 rounded-full flex items-center justify-center mb-6">
          <Bell size={32} className="text-accent-marquee" />
        </div>
        
        <h1 className="text-3xl font-bold text-text-primary mb-2">You got a seat!</h1>
        <p className="text-text-muted mb-8">
          Good news! A seat in the <strong>{offer.seat.categoryName}</strong> category has become available from your waitlist.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-12 mb-8 bg-surface/30 p-8 rounded-2xl border border-surface">
          <div className="flex flex-col items-center">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-4">Your Offered Seat</p>
            <div className="transform scale-150 mb-2">
              <SeatCell
                id={offer.showSeatId}
                label={`${offer.seat.categoryName.substring(0, 1).toUpperCase()}-${offer.seat.rowLabel}${offer.seat.seatNumber}`}
                category={offer.seat.categoryName}
                status="YOUR_SELECTION"
                holdExpiresAt={offer.expiresAt}
                onToggle={() => {}}
              />
            </div>
          </div>

          <div className="hidden md:block w-px h-24 bg-surface"></div>

          <div className="flex flex-col items-center">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-4">Offer Expires In</p>
            <span className="font-mono text-4xl font-bold text-accent-marquee animate-pulse">
              {timeLeft || '--:--'}
            </span>
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={isAccepting || isExpiredLocally}
          className="btn-primary w-full max-w-sm py-4 text-lg"
        >
          {isAccepting ? 'Confirming...' : 'Accept & book'}
        </button>
        
        <p className="text-xs text-text-muted text-center mt-4 max-w-sm mx-auto">
          If you don't accept before the timer runs out, this seat will be offered to the next person on the waitlist.
        </p>
      </div>
    </div>
  );
}