import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!socketRef.current) {
      // Typically VITE_API_URL is like http://localhost:4000/api
      const url = import.meta.env.PROD ? 'https://ticket-booking-backend-3v95.onrender.com' : 'http://localhost:4000';
      
      socketRef.current = io(url, {
        auth: { token },
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected:', socketRef.current?.id);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [token]);

  const joinShow = useCallback((showId: string) => {
    socketRef.current?.emit('join-show', showId);
  }, []);

  const leaveShow = useCallback((showId: string) => {
    socketRef.current?.emit('leave-show', showId);
  }, []);

  const subscribeToSeatUpdates = useCallback((
    callbacks: {
      onSeatHeld?: (data: { seatId: string; holdExpiresAt: string }) => void;
      onSeatReleased?: (data: { seatId: string }) => void;
      onSeatBooked?: (data: { seatId: string }) => void;
      onSeatSoftHeld?: (data: { seatId: string }) => void;
      onSeatSoftReleased?: (data: { seatId: string }) => void;
      onInitialSoftHolds?: (seatIds: string[]) => void;
    }
  ) => {
    const { onSeatHeld, onSeatReleased, onSeatBooked, onSeatSoftHeld, onSeatSoftReleased, onInitialSoftHolds } = callbacks;
    
    if (onSeatHeld) socketRef.current?.on('seat:held', onSeatHeld);
    if (onSeatReleased) socketRef.current?.on('seat:released', onSeatReleased);
    if (onSeatBooked) socketRef.current?.on('seat:booked', onSeatBooked);
    if (onSeatSoftHeld) socketRef.current?.on('seat:soft-held', onSeatSoftHeld);
    if (onSeatSoftReleased) socketRef.current?.on('seat:soft-released', onSeatSoftReleased);
    if (onInitialSoftHolds) socketRef.current?.on('seat:initial-soft-holds', onInitialSoftHolds);

    return () => {
      if (onSeatHeld) socketRef.current?.off('seat:held', onSeatHeld);
      if (onSeatReleased) socketRef.current?.off('seat:released', onSeatReleased);
      if (onSeatBooked) socketRef.current?.off('seat:booked', onSeatBooked);
      if (onSeatSoftHeld) socketRef.current?.off('seat:soft-held', onSeatSoftHeld);
      if (onSeatSoftReleased) socketRef.current?.off('seat:soft-released', onSeatSoftReleased);
      if (onInitialSoftHolds) socketRef.current?.off('seat:initial-soft-holds', onInitialSoftHolds);
    };
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, joinShow, leaveShow, subscribeToSeatUpdates, on, emit };
}