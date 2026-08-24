import { useState, useEffect } from 'react';

export function useHoldCountdown(holdId: string | null, seats: any[], selectedSeatIds: string[]) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!holdId) {
      setTimeLeft('');
      setIsExpired(false);
      return;
    }
    
    let expiry: number | null = null;
    seats.forEach(s => {
      if (selectedSeatIds.includes(s.id) && s.holdExpiresAt) {
        const time = new Date(s.holdExpiresAt).getTime();
        if (expiry === null || time < expiry) {
          expiry = time;
        }
      }
    });

    if (!expiry) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry! - now) / 1000));
      if (diff === 0) {
        setTimeLeft('00:00');
        setIsExpired(true);
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setTimeLeft(`${m}:${s}`);
      }
    }, 1000);

    // Run once immediately
    const now = Date.now();
    const diff = Math.max(0, Math.floor((expiry - now) / 1000));
    if (diff === 0) {
      setTimeLeft('00:00');
      setIsExpired(true);
    } else {
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setTimeLeft(`${m}:${s}`);
      setIsExpired(false);
    }

    return () => clearInterval(interval);
  }, [holdId, seats, selectedSeatIds]);

  return { timeLeft, isExpired };
}
