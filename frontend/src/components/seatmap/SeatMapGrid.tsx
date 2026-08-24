import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { SeatCell, SeatStatus } from './SeatCell';

export interface SeatMapSeat {
  id: string;
  seatId: string;
  rowLabel: string;
  seatNumber: number;
  x: number;
  y: number;
  categoryId: string;
  categoryName: string;
  categoryBaseLabel: string;
  status: string;
  heldByUserId: string | null;
  holdExpiresAt: string | null;
  price: number;
}

interface SeatMapGridProps {
  seats: SeatMapSeat[];
  selectedSeatIds: string[];
  onToggleSeat: (id: string, isSelecting: boolean) => void;
  isHoldLoading?: boolean;
}

export function SeatMapGrid({ seats, selectedSeatIds, onToggleSeat, isHoldLoading }: SeatMapGridProps) {
  const { maxX, maxY, categories } = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    const catMap = new Map<string, { name: string, price: number }>();
    seats.forEach(s => {
      if (s.x > maxX) maxX = s.x;
      if (s.y > maxY) maxY = s.y;
      if (!catMap.has(s.categoryId)) {
        catMap.set(s.categoryId, { name: s.categoryName, price: s.price });
      }
    });
    return { maxX, maxY, categories: Array.from(catMap.values()) };
  }, [seats]);

  const rows = Array.from({ length: maxY + 1 }, (_, i) => i);

  return (
    <div className="w-full max-w-full overflow-auto scrollbar-hide py-4 md:py-8">
      <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
        {categories.map(cat => {
          const isVip = cat.name.toLowerCase().includes('vip') || cat.name.toLowerCase().includes('premium');
          return (
            <div key={cat.name} className={`badge bg-surface border text-text-primary px-3 py-1 flex items-center gap-1.5 ${isVip ? 'border-accent-primary' : 'border-state-available'}`}>
              {isVip && <Star size={12} fill="currentColor" className="text-accent-primary" />}
              {cat.name} - ₹{(cat.price / 100).toFixed(2)}
            </div>
          );
        })}
      </div>

      <div 
        className="w-max mx-auto relative grid gap-x-3 gap-y-4 p-8 bg-surface/30 rounded-2xl border border-surface/50"
        style={{
          gridTemplateColumns: `minmax(40px, 40px) repeat(${maxX + 1}, minmax(40px, 40px)) minmax(40px, 40px)`,
        }}
      >
        {/* Curved Stage indicator */}
        <div 
          className="col-span-full h-16 flex items-end justify-center mb-12"
          style={{ gridRow: 1 }}
        >
          <div className="w-3/4 h-full border-t-8 border-surface rounded-t-[100%] flex items-start justify-center shadow-[0_-15px_30px_rgba(255,255,255,0.05)] relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-surface/40 to-transparent opacity-50" />
          </div>
        </div>

        {/* Row labels Left & Right */}
        {rows.map(y => {
          const seatInRow = seats.find(s => s.y === y);
          const rowLabel = seatInRow ? seatInRow.rowLabel : String.fromCharCode(65 + y);
          
          // Introduce a visual gap (aisle) after row 3 (the 4th row)
          const gridRow = y + 2 + (y > 3 ? 1 : 0);
          
          return (
            <React.Fragment key={`row-labels-${y}`}>
              <div 
                style={{ gridColumn: 1, gridRow }}
                className="flex items-center justify-center text-text-primary font-bold text-xl font-mono"
              >
                {rowLabel}
              </div>
              <div 
                style={{ gridColumn: maxX + 3, gridRow }}
                className="flex items-center justify-center text-text-primary font-bold text-xl font-mono"
              >
                {rowLabel}
              </div>
            </React.Fragment>
          );
        })}

        {/* Seats */}
        {seats.map(seat => {
          let status: SeatStatus = seat.status as SeatStatus;
          if (selectedSeatIds.includes(seat.id)) {
            status = 'YOUR_SELECTION';
          }
          
          const gridRow = seat.y + 2 + (seat.y > 3 ? 1 : 0);
          const gridColumn = seat.x + 2;
          
          return (
            <div 
              key={seat.id} 
              style={{ gridColumn, gridRow }}
              className="flex items-center justify-center"
            >
              <SeatCell
                id={seat.id}
                label={`${seat.categoryBaseLabel}-${seat.rowLabel}${seat.seatNumber}`}
                category={seat.categoryName}
                status={status}
                holdExpiresAt={seat.holdExpiresAt}
                onToggle={onToggleSeat}
                disabled={isHoldLoading}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
