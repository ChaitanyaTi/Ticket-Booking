import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useSocket } from '../../hooks/useSocket';
import { useHoldCountdown } from '../../hooks/useHoldCountdown';
import { SeatMapGrid, SeatMapSeat } from '../../components/seatmap/SeatMapGrid';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

interface ShowDetails {
  id: string;
  eventId: string;
  eventTitle: string;
  eventType: string;
  venueId: string;
  venueName: string;
  date: string;
  time: string;
  status: string;
}

interface CategoryDetails {
  id: string;
  name: string;
  baseLabel: string;
  price: number;
}

export function SeatMap() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const { joinShow, leaveShow, subscribeToSeatUpdates, emit } = useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [seats, setSeats] = useState<SeatMapSeat[]>([]);
  const [categories, setCategories] = useState<CategoryDetails[]>([]);
  
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [softHeldSeats, setSoftHeldSeats] = useState<Set<string>>(new Set());
  const [holdId, setHoldId] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    if (!showId) return;
    loadSeatMap();
    joinShow(showId);

    const unsubscribe = subscribeToSeatUpdates({
      onSeatHeld: ({ seatId, holdExpiresAt }) => {
        setSeats(prev => prev.map(s => s.seatId === seatId ? { ...s, status: 'HELD', holdExpiresAt } : s));
      },
      onSeatReleased: ({ seatId }) => {
        setSeats(prev => prev.map(s => s.seatId === seatId ? { ...s, status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null } : s));
        // If one of our selected seats is released externally (e.g. timeout), remove it from selection
        setSelectedSeatIds(prev => prev.filter(id => {
          const seat = seats.find(st => st.seatId === seatId);
          return seat ? id !== seat.id : true;
        }));
      },
      onSeatBooked: ({ seatId }) => {
        setSeats(prev => prev.map(s => s.seatId === seatId ? { ...s, status: 'BOOKED' } : s));
      },
      onInitialSoftHolds: (seatIds) => {
        setSoftHeldSeats(new Set(seatIds));
      },
      onSeatSoftHeld: ({ seatId }) => {
        setSoftHeldSeats(prev => new Set(prev).add(seatId));
      },
      onSeatSoftReleased: ({ seatId }) => {
        setSoftHeldSeats(prev => {
          const next = new Set(prev);
          next.delete(seatId);
          return next;
        });
      }
    });

    return () => {
      leaveShow(showId);
      unsubscribe();
    };
  }, [showId, joinShow, leaveShow, subscribeToSeatUpdates]);

  // Release hold on unmount if we have one
  useEffect(() => {
    return () => {
      if (holdId) {
        api.delete(`/shows/holds/${holdId}`).catch(console.error);
      }
    };
  }, [holdId]);

  const loadSeatMap = async () => {
    if (!showId) return;
    try {
      const data = await api.get<{ show: ShowDetails; seats: SeatMapSeat[]; categories: CategoryDetails[] }>(`/shows/${showId}/seatmap`);
      setShow(data.show);
      setSeats(data.seats);
      setCategories(data.categories);
    } catch (error: any) {
      toast.error('Failed to load seat map');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSeat = useCallback((id: string, isSelecting: boolean) => {
    if (holdId) {
      toast.error('You already have held seats. Please release them or continue to checkout.');
      return;
    }
    
    setSelectedSeatIds(prev => {
      const seat = seats.find(s => s.id === id);
      if (!seat) return prev;

      if (isSelecting) {
        if (prev.length >= 10) {
          toast.error('Maximum 10 seats allowed per booking');
          return prev;
        }
        emit('seat:soft-select', { showId, seatId: seat.seatId });
        return [...prev, id];
      }
      emit('seat:soft-deselect', { showId, seatId: seat.seatId });
      return prev.filter(seatId => seatId !== id);
    });
  }, [holdId, emit, showId, seats]);

  const handleHoldSeats = async () => {
    if (!showId || selectedSeatIds.length === 0) return;
    setIsHolding(true);
    try {
      const response = await api.post<{ holdId: string; seats: any[]; expiresAt: string }>(`/shows/${showId}/hold`, {
        seatIds: selectedSeatIds
      });
      setHoldId(response.holdId);
      
      // Update local state to show our hold
      setSeats(prev => prev.map(s => {
        if (selectedSeatIds.includes(s.id)) {
          return { ...s, status: 'YOUR_SELECTION', holdExpiresAt: response.expiresAt };
        }
        return s;
      }));
      toast.success('Seats held successfully! You have 10 minutes to checkout.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to hold seats');
      setSelectedSeatIds([]); // Clear selection if someone else beat us to it
    } finally {
      setIsHolding(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!holdId) return;
    setIsHolding(true);
    try {
      await api.delete(`/shows/holds/${holdId}`, { seatIds: selectedSeatIds });
      setHoldId(null);
      setSelectedSeatIds([]);
      // Sockets will revert the seats to AVAILABLE
    } catch (error: any) {
      toast.error('Failed to release hold');
    } finally {
      setIsHolding(false);
    }
  };

  const handleCheckout = () => {
    navigate(`/checkout/${showId}`, { state: { holdId, selectedSeatIds, seats: seats.filter(s => selectedSeatIds.includes(s.id)), show } });
  };

  const handleJoinWaitlist = async (categoryId: string) => {
    if (!showId) return;
    try {
      await api.post(`/shows/${showId}/waitlist`, { categoryId });
      toast.success('Joined waitlist successfully! We will email you if seats open up.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join waitlist');
    }
  };

  const totalPrice = useMemo(() => {
    return selectedSeatIds.reduce((sum, id) => {
      const seat = seats.find(s => s.id === id);
      return sum + (seat?.price || 0);
    }, 0);
  }, [selectedSeatIds, seats]);

  const { timeLeft, isExpired } = useHoldCountdown(holdId, seats, selectedSeatIds);

  useEffect(() => {
    if (isExpired) {
      setHoldId(null);
      setSelectedSeatIds([]);
      toast.error('Your hold expired — seats have been released');
    }
  }, [isExpired]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-accent-marquee border-t-transparent" />
      </div>
    );
  }

  if (!show) return <div className="p-8 text-center text-text-muted">Show not found</div>;

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] relative">
      {/* Header */}
      <div className="px-4 md:px-8 py-4 md:py-6 border-b border-surface/50 flex flex-col md:flex-row md:justify-between md:items-end gap-4 sticky top-0 md:top-16 bg-bg-app/90 backdrop-blur z-20">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">{show.eventTitle}</h1>
          <p className="text-sm md:text-base text-text-muted flex flex-wrap gap-2 md:gap-4">
            <span>{show.venueName}</span>
            <span className="hidden md:inline">•</span>
            <span>{new Date(show.date).toLocaleDateString()} at {show.time}</span>
          </p>
        </div>
        {timeLeft && (
          <div className="flex items-center gap-3 bg-surface border border-accent-marquee/30 px-4 py-2 rounded-2xl self-start md:self-auto">
            <span className="text-sm text-text-muted">Hold expires in</span>
            <span className="font-mono text-xl font-bold text-accent-primary">{timeLeft}</span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <SeatMapGrid 
          seats={seats.map(s => ({
            ...s,
            status: (!selectedSeatIds.includes(s.id) && softHeldSeats.has(s.seatId) && s.status === 'AVAILABLE') ? 'SOFT_HELD' : s.status
          }))} 
          selectedSeatIds={selectedSeatIds} 
          onToggleSeat={handleToggleSeat}
          isHoldLoading={isHolding}
        />
        
        {/* Category Legend & Waitlist */}
        <div className="px-4 md:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map(cat => {
            const catSeats = seats.filter(s => s.categoryId === cat.id);
            const availableCount = catSeats.filter(s => s.status === 'AVAILABLE').length;
            const isSoldOut = availableCount === 0 && catSeats.length > 0;
            
            return (
              <div key={cat.id} className="card p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-bold flex items-center gap-1.5 ${(cat.name.toLowerCase().includes('vip') || cat.name.toLowerCase().includes('premium')) ? 'text-accent-primary' : 'text-state-available'}`}>
                      {(cat.name.toLowerCase().includes('vip') || cat.name.toLowerCase().includes('premium')) && <Star size={14} fill="currentColor" />}
                      {cat.name}
                    </h3>
                    <p className="font-mono text-sm text-accent-marquee">₹{(cat.price / 100).toFixed(2)}</p>
                  </div>
                  {isSoldOut ? (
                    <span className="badge-waitlist">Sold Out</span>
                  ) : (
                    <span className="badge-available">{availableCount} left</span>
                  )}
                </div>
                
                {isSoldOut && (
                  <button 
                    onClick={() => handleJoinWaitlist(cat.id)}
                    className="btn-secondary w-full text-xs py-1.5 mt-2"
                  >
                    Join Waitlist
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-16 md:bottom-0 bg-surface border-t border-surface/50 p-4 md:p-6 flex flex-col sm:flex-row sm:justify-between items-center gap-4 shadow-sm z-20">
        <div className="flex flex-col items-center sm:items-start w-full sm:w-auto text-center sm:text-left">
          <span className="text-text-muted text-sm mb-1">
            {selectedSeatIds.length} {selectedSeatIds.length === 1 ? 'seat' : 'seats'} selected
          </span>
          <span className="font-mono text-2xl font-bold text-text-primary">
            ₹{(totalPrice / 100).toFixed(2)}
          </span>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto justify-center">
          {holdId && (
            <button 
              onClick={handleReleaseHold} 
              disabled={isHolding}
              className="btn-ghost text-accent-stage hover:bg-accent-stage/10 flex-1 sm:flex-none"
            >
              Release Seats
            </button>
          )}
          
          {!holdId ? (
            <button 
              onClick={handleHoldSeats}
              disabled={selectedSeatIds.length === 0 || isHolding}
              className="btn-primary flex-1 sm:flex-none"
            >
              Hold Seats
            </button>
          ) : (
            <button 
              onClick={handleCheckout}
              disabled={isHolding}
              className="btn-primary flex-1 sm:flex-none"
            >
              Checkout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}