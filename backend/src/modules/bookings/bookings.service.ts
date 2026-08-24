import { prisma } from '../../utils/prisma';
import { generateQRCode } from '../email/email.service';

export async function getUserBookings(userId: string) {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: {
      show: {
        include: {
          event: {
            include: {
              venue: true,
            },
          },
        },
      },
      seats: {
        include: {
          showSeat: {
            include: {
              seat: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const mappedBookings = bookings.map((booking: any) => ({
    id: booking.id,
    bookingRef: booking.bookingRef,
    status: booking.status,
    totalAmount: booking.totalAmount,
    createdAt: booking.createdAt,
    eventTitle: booking.show.event.title,
    eventType: booking.show.event.type,
    venueName: booking.show.event.venue.name,
    showDate: booking.show.date,
    showTime: booking.show.time,
    seats: booking.seats.map((s: any) => ({
      id: s.showSeat.seat.id,
      label: `${s.showSeat.seat.category.baseLabel}${s.showSeat.seat.rowLabel}${s.showSeat.seat.seatNumber}`,
      category: s.showSeat.seat.category.name,
    })),
  }));

  // Generate QR codes for each booking concurrently
  const bookingsWithQR = await Promise.all(
    mappedBookings.map(async (b) => {
      const qrData = JSON.stringify({ bookingRef: b.bookingRef, type: 'booking' });
      const qrCodeUrl = await generateQRCode(qrData);
      return { ...b, qrCodeUrl };
    })
  );

  return bookingsWithQR;
}
