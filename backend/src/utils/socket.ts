import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { config } from '../config';
import redis from './redis';

let io: SocketIOServer;

export function initIo(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected to socket.io:', socket.id);

    socket.on('join-show', async (showId: string) => {
      socket.join(`show:${showId}`);
      console.log(`Socket ${socket.id} joined room show:${showId}`);
      
      try {
        const softHolds = await redis.hgetall(`soft_holds:${showId}`);
        const seatIds = Object.keys(softHolds);
        socket.emit('seat:initial-soft-holds', seatIds);
      } catch (err) {
        console.error('Error fetching soft holds on join', err);
      }
    });

    socket.on('seat:soft-select', async ({ showId, seatId }: { showId: string, seatId: string }) => {
      if (!showId || !seatId) return;
      try {
        await redis.hset(`soft_holds:${showId}`, seatId, socket.id);
        await redis.sadd(`socket_soft_holds:${socket.id}`, `${showId}:${seatId}`);
        socket.to(`show:${showId}`).emit('seat:soft-held', { seatId });
      } catch (err) {
        console.error('Error in seat:soft-select', err);
      }
    });

    socket.on('seat:soft-deselect', async ({ showId, seatId }: { showId: string, seatId: string }) => {
      if (!showId || !seatId) return;
      try {
        await redis.hdel(`soft_holds:${showId}`, seatId);
        await redis.srem(`socket_soft_holds:${socket.id}`, `${showId}:${seatId}`);
        socket.to(`show:${showId}`).emit('seat:soft-released', { seatId });
      } catch (err) {
        console.error('Error in seat:soft-deselect', err);
      }
    });

    socket.on('leave-show', async (showId: string) => {
      socket.leave(`show:${showId}`);
      console.log(`Socket ${socket.id} left room show:${showId}`);
      try {
        const heldItems = await redis.smembers(`socket_soft_holds:${socket.id}`);
        for (const item of heldItems) {
          const [itemShowId, seatId] = item.split(':');
          if (itemShowId === showId && seatId) {
            await redis.hdel(`soft_holds:${showId}`, seatId);
            await redis.srem(`socket_soft_holds:${socket.id}`, item);
            io.to(`show:${showId}`).emit('seat:soft-released', { seatId });
          }
        }
      } catch (err) {
        console.error('Error cleaning up soft holds on leave-show', err);
      }
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      try {
        const heldItems = await redis.smembers(`socket_soft_holds:${socket.id}`);
        for (const item of heldItems) {
          const [showId, seatId] = item.split(':');
          if (showId && seatId) {
            await redis.hdel(`soft_holds:${showId}`, seatId);
            io.to(`show:${showId}`).emit('seat:soft-released', { seatId });
          }
        }
        await redis.del(`socket_soft_holds:${socket.id}`);
      } catch (err) {
        console.error('Error cleaning up soft holds for socket', err);
      }
    });
  });

  return io;
}

export function getIo(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
}
