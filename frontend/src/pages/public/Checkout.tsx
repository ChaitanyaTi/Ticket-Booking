import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { useHoldCountdown } from '../../hooks/useHoldCountdown';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { SeatMapSeat } from '../../components/seatmap/SeatMapGrid';

interface CheckoutLocationState {
  holdId: string;
  selectedSeatIds: string[];
  seats: SeatMapSeat[];
  show: any;
}

interface BookingSuccessState {
  bookingId: string;
  bookingRef: string;
  totalAmount: number;
  qrCodeUrl: string;
}

export function Checkout() {
  const { showId } = useParams<{ showId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const state = location.state as CheckoutLocationState;
  
  const [isConfirming, setIsConfirming] = useState(false);
  const [successData, setSuccessData] = useState<BookingSuccessState | null>(null);
  
  const [emailOption, setEmailOption] = useState<'registered' | 'custom'>('registered');
  const [customEmail, setCustomEmail] = useState('');

  // If accessed without proper state or if user refreshes, send them back
  useEffect(() => {
    if (!state?.holdId || !state?.selectedSeatIds || !state?.seats) {
      toast.error('Invalid checkout session');
      navigate(showId ? `/shows/${showId}/seats` : '/');
    }
  }, [state, navigate, showId]);

  const { timeLeft, isExpired } = useHoldCountdown(
    successData ? null : state?.holdId, 
    state?.seats || [], 
    state?.selectedSeatIds || []
  );

  useEffect(() => {
    if (isExpired && !successData) {
      toast.error('Your hold expired — seats have been released');
      navigate(`/shows/${showId}/seats`);
    }
  }, [isExpired, navigate, showId, successData]);

  if (!state?.holdId || !state?.seats) return null;

  const totalAmount = state.seats.reduce((sum, seat) => sum + seat.price, 0);

  const handleConfirm = async () => {
    if (!showId) return;
    
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (emailOption === 'custom' && !emailRegex.test(customEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsConfirming(true);
    try {
      const payload = {
        seatIds: state.selectedSeatIds,
        customEmail: emailOption === 'custom' ? customEmail : undefined
      };
      const response = await api.post<BookingSuccessState>(`/shows/${showId}/book`, payload);
      setSuccessData(response);
      toast.success('Booking confirmed!');
    } catch (error: any) {
      toast.error(error.message || 'Booking failed');
      setIsConfirming(false);
    }
  };

  if (successData) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="card text-center p-8 border-2 border-accent-marquee/30 bg-gradient-to-b from-surface to-bg-night">
          <div className="w-16 h-16 mx-auto bg-accent-marquee/20 rounded-full flex items-center justify-center mb-6">
            <Check size={32} className="text-accent-marquee" />
          </div>
          
          <h1 className="text-3xl font-bold text-text-primary mb-2">Booking Confirmed!</h1>
          <p className="text-text-muted mb-8">
            Your tickets for {state.show.eventTitle} have been secured. We've also emailed a copy of your ticket to you.
          </p>

          <div className="bg-bg-night border border-surface/50 rounded-2xl p-6 mb-8 inline-block max-w-sm w-full mx-auto shadow-sm">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-4">Your Ticket QR Code</p>
            <div className="bg-white p-4 rounded-2xl mx-auto inline-block mb-4 shadow-sm">
              <QRCodeCanvas 
                value={JSON.stringify({ bookingRef: successData.bookingRef, type: 'booking' })} 
                size={192} 
                fgColor="#0F1225"
                bgColor="#FFB627"
                level="Q"
              />
            </div>
            <p className="font-mono text-2xl font-bold text-accent-marquee tracking-[0.2em]">{successData.bookingRef}</p>
          </div>

          <div className="flex gap-4 justify-center">
            <Link to="/bookings" className="btn-primary">
              View My Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Checkout</h1>
          <p className="text-text-muted mt-1 flex flex-wrap gap-2">
            <span>{state.show.eventTitle}</span>
            <span className="hidden sm:inline">•</span>
            <span>{new Date(state.show.date).toLocaleDateString()} at {state.show.time}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-surface border border-accent-marquee/30 px-6 py-3 rounded-2xl shadow-sm w-full md:w-auto justify-between md:justify-start">
          <span className="text-sm text-text-muted">Hold expires in</span>
          <span className="font-mono text-2xl font-bold text-accent-marquee animate-pulse">
            {timeLeft || '--:--'}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="card p-6">
            <h2 className="text-xl font-bold text-text-primary mb-6 border-b border-surface/50 pb-4">Order Summary</h2>
            
            <div className="space-y-4">
              {state.seats.map(seat => (
                <div key={seat.id} className="flex justify-between items-center p-4 bg-bg-night rounded-2xl border border-surface/30">
                  <div>
                    <p className="font-bold text-text-primary">{seat.categoryName}</p>
                    <p className="text-sm text-text-muted font-mono mt-1">Row {seat.rowLabel}, Seat {seat.seatNumber}</p>
                  </div>
                  <span className="font-mono text-accent-marquee font-bold">
                    ₹{(seat.price / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card p-6 sticky top-4 md:top-24">
            <h2 className="text-xl font-bold text-text-primary mb-4">Ticket Delivery</h2>
            <div className="mb-6 space-y-4 border-b border-surface/50 pb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="radio" 
                  name="emailOption"
                  className="mt-1"
                  checked={emailOption === 'registered'}
                  onChange={() => setEmailOption('registered')}
                />
                <div>
                  <div className="text-text-primary font-medium">Registered Email</div>
                  <div className="text-sm text-text-muted">Send to my account email</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="radio" 
                  name="emailOption"
                  className="mt-1"
                  checked={emailOption === 'custom'}
                  onChange={() => setEmailOption('custom')}
                />
                <div className="w-full">
                  <div className="text-text-primary font-medium">Different Email</div>
                  <div className="text-sm text-text-muted mb-2">Send tickets to someone else</div>
                  {emailOption === 'custom' && (
                    <input 
                      type="email" 
                      placeholder="Enter email address"
                      className="input w-full mt-1"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                    />
                  )}
                </div>
              </label>
            </div>

            <h2 className="text-xl font-bold text-text-primary mb-6">Payment</h2>
            
            <div className="flex justify-between items-center mb-6 pt-4 border-t border-surface/50">
              <span className="text-text-muted">Total</span>
              <span className="font-mono text-3xl font-bold text-text-primary">
                ₹{(totalAmount / 100).toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleConfirm}
              disabled={isConfirming || isExpired}
              className="btn-primary w-full py-4 text-lg"
            >
              {isConfirming ? 'Confirming...' : 'Confirm booking'}
            </button>
            
            <p className="text-xs text-text-muted text-center mt-4">
              By confirming, you agree to our terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}