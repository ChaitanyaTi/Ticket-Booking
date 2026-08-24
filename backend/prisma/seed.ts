import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  // Delete in reverse order of relations to satisfy foreign key constraints
  await prisma.waitlistOffer.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.showSeat.deleteMany();
  await prisma.showSeatPricing.deleteMany();
  await prisma.show.deleteMany();
  await prisma.event.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.seatCategory.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding Users...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@demo.com', passwordHash, role: 'ADMIN' }
  });

  const organiser1 = await prisma.user.create({
    data: { name: 'LiveNation', email: 'organiser1@demo.com', passwordHash, role: 'ORGANISER' }
  });
  const organiser2 = await prisma.user.create({
    data: { name: 'Indie Events', email: 'organiser2@demo.com', passwordHash, role: 'ORGANISER' }
  });

  const customer1 = await prisma.user.create({
    data: { name: 'Alice Customer', email: 'customer1@demo.com', passwordHash, role: 'CUSTOMER' }
  });
  const customer2 = await prisma.user.create({
    data: { name: 'Bob Customer', email: 'customer2@demo.com', passwordHash, role: 'CUSTOMER' }
  });
  const customer3 = await prisma.user.create({
    data: { name: 'Charlie Customer', email: 'customer3@demo.com', passwordHash, role: 'CUSTOMER' }
  });

  console.log('Seeding Venues and Seats...');
  
  // Venue 1: Grand Arena
  const venue1 = await prisma.venue.create({
    data: { name: 'Grand Arena', address: '100 Main St, Metropolis', createdByAdminId: admin.id }
  });
  const v1CatPremium = await prisma.seatCategory.create({
    data: { venueId: venue1.id, name: 'Premium', baseLabel: 'P' }
  });
  const v1CatStandard = await prisma.seatCategory.create({
    data: { venueId: venue1.id, name: 'Standard', baseLabel: 'S' }
  });
  
  // Create seats for Venue 1 (Premium: Rows A-B, Standard: Rows C-H, 12 seats per row)
  const v1Seats = [];
  for (let r = 0; r < 8; r++) {
    const isPremium = r < 2;
    const catId = isPremium ? v1CatPremium.id : v1CatStandard.id;
    const rowLabel = String.fromCharCode(65 + r);
    for (let c = 0; c < 12; c++) {
      v1Seats.push({
        venueId: venue1.id,
        categoryId: catId,
        rowLabel,
        seatNumber: c + 1,
        x: c,
        y: r,
      });
    }
  }
  await prisma.seat.createMany({ data: v1Seats });

  // Venue 2: Starlight Cinema
  const venue2 = await prisma.venue.create({
    data: { name: 'Starlight Cinema', address: '42 Hollywood Blvd, Star City', createdByAdminId: admin.id }
  });
  const v2CatVIP = await prisma.seatCategory.create({
    data: { venueId: venue2.id, name: 'VIP', baseLabel: 'V' }
  });
  const v2CatRegular = await prisma.seatCategory.create({
    data: { venueId: venue2.id, name: 'Regular', baseLabel: 'R' }
  });

  const v2Seats = [];
  for (let r = 0; r < 6; r++) {
    const isVip = r === 0;
    const catId = isVip ? v2CatVIP.id : v2CatRegular.id;
    const rowLabel = String.fromCharCode(65 + r);
    for (let c = 0; c < 10; c++) {
      v2Seats.push({
        venueId: venue2.id,
        categoryId: catId,
        rowLabel,
        seatNumber: c + 1,
        x: c,
        y: r,
      });
    }
  }
  await prisma.seat.createMany({ data: v2Seats });

  console.log('Seeding Events and Shows...');

  // Event 1 (Concert)
  const event1 = await prisma.event.create({
    data: {
      title: 'The Eras Tour',
      description: 'The most anticipated concert of the year.',
      type: 'CONCERT',
      organiserId: organiser1.id,
      venueId: venue1.id
    }
  });

  // Event 1 - Future Show
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);
  const show1 = await prisma.show.create({
    data: { eventId: event1.id, date: futureDate, time: '20:00', status: 'UPCOMING' }
  });
  await prisma.showSeatPricing.createMany({
    data: [
      { showId: show1.id, categoryId: v1CatPremium.id, price: 15000 }, // 150.00
      { showId: show1.id, categoryId: v1CatStandard.id, price: 7500 }, // 75.00
    ]
  });

  // Initialize Show Seats for Show 1
  const allV1Seats = await prisma.seat.findMany({ where: { venueId: venue1.id } });
  await prisma.showSeat.createMany({
    data: allV1Seats.map(s => ({ showId: show1.id, seatId: s.id, status: 'AVAILABLE' }))
  });

  // Event 1 - Past Show (For "My Bookings" and Revenue)
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);
  const pastShow = await prisma.show.create({
    data: { eventId: event1.id, date: pastDate, time: '19:00', status: 'COMPLETED' }
  });
  await prisma.showSeatPricing.createMany({
    data: [
      { showId: pastShow.id, categoryId: v1CatPremium.id, price: 15000 },
      { showId: pastShow.id, categoryId: v1CatStandard.id, price: 7500 },
    ]
  });
  await prisma.showSeat.createMany({
    data: allV1Seats.map(s => ({ showId: pastShow.id, seatId: s.id, status: 'AVAILABLE' }))
  });

  // Event 2 (Movie)
  const event2 = await prisma.event.create({
    data: {
      title: 'Dune: Part Two (IMAX 70mm)',
      description: 'Experience the spice on the biggest screen possible.',
      type: 'MOVIE',
      organiserId: organiser2.id,
      venueId: venue2.id
    }
  });

  // Event 2 - Future Show
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const show2 = await prisma.show.create({
    data: { eventId: event2.id, date: tomorrow, time: '18:30', status: 'UPCOMING' }
  });
  await prisma.showSeatPricing.createMany({
    data: [
      { showId: show2.id, categoryId: v2CatVIP.id, price: 2500 }, // 25.00
      { showId: show2.id, categoryId: v2CatRegular.id, price: 1200 }, // 12.00
    ]
  });
  
  const allV2Seats = await prisma.seat.findMany({ where: { venueId: venue2.id } });
  await prisma.showSeat.createMany({
    data: allV2Seats.map(s => ({ showId: show2.id, seatId: s.id, status: 'AVAILABLE' }))
  });

  console.log('Seeding Past Bookings...');
  
  // Create past booking for Customer 1
  const pastSeats = await prisma.showSeat.findMany({ where: { showId: pastShow.id }, take: 4, include: { seat: true } });
  await prisma.showSeat.updateMany({
    where: { id: { in: pastSeats.map(s => s.id) } },
    data: { status: 'BOOKED' }
  });
  
  const pastBooking = await prisma.booking.create({
    data: {
      userId: customer1.id,
      showId: pastShow.id,
      bookingRef: crypto.randomUUID().slice(0, 8).toUpperCase(),
      status: 'CONFIRMED',
      totalAmount: 15000 * 4, 
      createdAt: pastDate,
      updatedAt: pastDate
    }
  });
  await prisma.bookingSeat.createMany({
    data: pastSeats.map(s => ({ bookingId: pastBooking.id, showSeatId: s.id }))
  });

  console.log('Simulating Almost Sold Out Show...');
  // Make all but 2 premium seats BOOKED in show1 to test waitlist
  const premiumShowSeats = await prisma.showSeat.findMany({
    where: { showId: show1.id, seat: { categoryId: v1CatPremium.id } },
    include: { seat: true }
  });

  const seatsToBook = premiumShowSeats.slice(0, premiumShowSeats.length - 2);
  await prisma.showSeat.updateMany({
    where: { id: { in: seatsToBook.map(s => s.id) } },
    data: { status: 'BOOKED' }
  });

  const almostSoldOutBooking = await prisma.booking.create({
    data: {
      userId: customer2.id,
      showId: show1.id,
      bookingRef: crypto.randomUUID().slice(0, 8).toUpperCase(),
      status: 'CONFIRMED',
      totalAmount: seatsToBook.length * 15000,
    }
  });
  await prisma.bookingSeat.createMany({
    data: seatsToBook.map(s => ({ bookingId: almostSoldOutBooking.id, showSeatId: s.id }))
  });

  console.log('✅ Seed completed successfully! Database is now populated with realistic demo data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
