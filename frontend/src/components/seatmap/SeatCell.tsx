import React, { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOFT_HELD' | 'BOOKED' | 'YOUR_SELECTION';

export interface SeatProps {
  id: string;
  label: string;
  category: string;
  status: SeatStatus;
  holdExpiresAt?: string | null;
  onToggle: (id: string, isSelecting: boolean) => void;
  disabled?: boolean;
}

export function SeatCell({ id, label, category, status, holdExpiresAt, onToggle, disabled }: SeatProps) {
  const isSelected = status === 'YOUR_SELECTION';
  const isAvailable = status === 'AVAILABLE';
  const isHeld = status === 'HELD';
  const isSoftHeld = status === 'SOFT_HELD';
  const isBooked = status === 'BOOKED';
  const isDisabled = disabled || isBooked || isHeld || isSoftHeld;
  const isVip = category.toLowerCase().includes('vip') || category.toLowerCase().includes('premium');

  const availableStyle = isVip
    ? 'bg-surface border-2 border-accent-primary text-text-primary hover:bg-accent-primary/10 focus-visible:ring-accent-primary focus-visible:ring-offset-1 focus-visible:border-transparent'
    : 'bg-surface border-2 border-state-available text-text-primary hover:bg-state-available/10 focus-visible:ring-state-available focus-visible:ring-offset-1 focus-visible:border-transparent';

  const ringRef = useRef<SVGCircleElement>(null);
  const [isClicked, setIsClicked] = useState(false);

  useEffect(() => {
    if (!isSelected || !holdExpiresAt) return;

    const expiryTime = new Date(holdExpiresAt).getTime();
    const HOLD_TTL = 10 * 60 * 1000; // 10 minutes total hold time

    let animationFrame: number;
    const updateRing = () => {
      if (!ringRef.current) return;
      const now = Date.now();
      const remaining = Math.max(0, expiryTime - now);
      const percentage = remaining / HOLD_TTL;
      
      const circumference = 2 * Math.PI * 18;
      const offset = circumference - (percentage * circumference);
      ringRef.current.style.strokeDashoffset = `${offset}`;
      
      if (remaining > 0) {
        animationFrame = requestAnimationFrame(updateRing);
      }
    };

    animationFrame = requestAnimationFrame(updateRing);
    return () => cancelAnimationFrame(animationFrame);
  }, [isSelected, holdExpiresAt]);

  const handleClick = () => {
    if (isDisabled) return;
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 150);
    onToggle(id, !isSelected);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const ariaLabel = `Seat ${label}, ${category}, ${status.toLowerCase().replace('_', ' ')}`;
  const seatNumber = label.split('-').pop() || label;

  return (
    <div className="relative inline-flex items-center justify-center w-10 h-10 group m-0.5">

      {/* Countdown Ring */}
      {isSelected && holdExpiresAt && (
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none motion-reduce:hidden" viewBox="0 0 40 40">
          <circle
            cx="20" cy="20" r="18"
            fill="none"
            stroke="currentColor"
            className="text-border-subtle"
            strokeWidth="2"
          />
          <circle
            ref={ringRef}
            cx="20" cy="20" r="18"
            fill="none"
            stroke="currentColor"
            className="text-accent-primary"
            strokeWidth="2"
            strokeDasharray={2 * Math.PI * 18}
            strokeDashoffset="0"
          />
        </svg>
      )}
      
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        aria-label={ariaLabel}
        tabIndex={isDisabled ? -1 : 0}
        className={`
          relative w-8 h-8 rounded-t-md rounded-b flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-150 z-10
          ${isClicked ? 'animate-seat-click' : ''}
          ${isAvailable ? availableStyle : ''}
          ${isSelected ? 'bg-accent-primary border-2 border-accent-primary text-white shadow-md' : ''}
          ${isHeld || isSoftHeld ? 'bg-state-held border-2 border-state-held text-text-muted cursor-not-allowed opacity-75' : ''}
          ${isBooked ? 'bg-text-muted border-2 border-text-muted text-surface cursor-not-allowed opacity-75' : ''}
        `}
      >
        <div className="absolute top-[25%] -left-1.5 w-1.5 h-[50%] bg-inherit border-y-2 border-l-2 border-current rounded-l-sm" />
        <div className="absolute top-[25%] -right-1.5 w-1.5 h-[50%] bg-inherit border-y-2 border-r-2 border-current rounded-r-sm" />
        <div className="z-10 flex flex-col items-center justify-center leading-none">
          {isVip && <Star size={8} fill="currentColor" className="mb-[1px]" />}
          <span>{seatNumber}</span>
        </div>
      </button>
    </div>
  );
}
