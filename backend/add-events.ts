import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding more events...');
  const organiser1 = await prisma.user.findFirst({ where: { role: 'ORGANISER' } });
  const organiser2 = await prisma.user.findFirst({ where: { role: 'ORGANISER', id: { not: organiser1?.id } } }) || organiser1;
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  const venue1 = await prisma.venue.findFirst({ where: { name: 'Grand Arena' } });
  const venue2 = await prisma.venue.findFirst({ where: { name: 'Starlight Cinema' } });

  if (!venue1 || !venue2 || !organiser1) {
    console.error('Initial data not found! Please run regular seed first if database is empty.');
    return;
  }

  const v1Categories = await prisma.seatCategory.findMany({ where: { venueId: venue1.id } });
  const v1CatPremium = v1Categories.find(c => c.name === 'Premium')!;
  const v1CatStandard = v1Categories.find(c => c.name === 'Standard')!;
  const allV1Seats = await prisma.seat.findMany({ where: { venueId: venue1.id } });

  const v2Categories = await prisma.seatCategory.findMany({ where: { venueId: venue2.id } });
  const v2CatVIP = v2Categories.find(c => c.name === 'VIP')!;
  const v2CatRegular = v2Categories.find(c => c.name === 'Regular')!;
  const allV2Seats = await prisma.seat.findMany({ where: { venueId: venue2.id } });

  const movies = [
    { title: 'Inception (Re-release)', desc: 'A thief who steals corporate secrets through the use of dream-sharing technology.' },
    { title: 'Interstellar (IMAX)', desc: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.' },
    { title: 'The Dark Knight', desc: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham.' },
    { title: 'Blade Runner 2049', desc: 'Young Blade Runner K\'s discovery of a long-buried secret leads him to track down former Blade Runner Rick Deckard.' },
    { title: 'Mad Max: Fury Road', desc: 'In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland.' },
    { title: 'Spider-Man: Across the Spider-Verse', desc: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People.' },
    { title: 'Oppenheimer (70mm)', desc: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.' }
  ];

  const concerts = [
    { title: 'Coldplay: Music of the Spheres', desc: 'Experience the magic of Coldplay live.' },
    { title: 'The Weeknd: After Hours', desc: 'A spectacular audio-visual journey.' },
    { title: 'Billie Eilish: Hit Me Hard and Soft', desc: 'The much awaited global tour.' },
    { title: 'Ed Sheeran: Mathematics Tour', desc: 'An intimate yet massive stadium experience.' },
    { title: 'Beyonce: Renaissance', desc: 'The Renaissance world tour.' },
    { title: 'Harry Styles: Love On Tour', desc: 'Bringing Love On Tour to your city.' },
    { title: 'Adele: Live', desc: 'An unforgettable evening with Adele.' },
    { title: 'Metallica: M72 World Tour', desc: 'No repeat weekend - 2 Nights, 2 Different Sets.' }
  ];

  const now = new Date();

  // Add Movies
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    console.log(`Adding movie: ${movie.title}`);
    const event = await prisma.event.create({
      data: {
        title: movie.title,
        description: movie.desc,
        type: 'MOVIE',
        organiserId: organiser2!.id,
        venueId: venue2.id
      }
    });

    const date = new Date(now);
    date.setDate(date.getDate() + (i + 2)); // Spread dates out
    const show = await prisma.show.create({
      data: { eventId: event.id, date, time: '19:00', status: 'UPCOMING' }
    });

    await prisma.showSeatPricing.createMany({
      data: [
        { showId: show.id, categoryId: v2CatVIP.id, price: 2000 },
        { showId: show.id, categoryId: v2CatRegular.id, price: 1000 },
      ]
    });

    await prisma.showSeat.createMany({
      data: allV2Seats.map(s => ({ showId: show.id, seatId: s.id, status: 'AVAILABLE' }))
    });
  }

  // Add Concerts
  for (let i = 0; i < concerts.length; i++) {
    const concert = concerts[i];
    console.log(`Adding concert: ${concert.title}`);
    const event = await prisma.event.create({
      data: {
        title: concert.title,
        description: concert.desc,
        type: 'CONCERT',
        organiserId: organiser1!.id,
        venueId: venue1.id
      }
    });

    const date = new Date(now);
    date.setDate(date.getDate() + (i + 5)); // Spread dates out
    const show = await prisma.show.create({
      data: { eventId: event.id, date, time: '20:30', status: 'UPCOMING' }
    });

    await prisma.showSeatPricing.createMany({
      data: [
        { showId: show.id, categoryId: v1CatPremium.id, price: 12000 },
        { showId: show.id, categoryId: v1CatStandard.id, price: 6000 },
      ]
    });

    await prisma.showSeat.createMany({
      data: allV1Seats.map(s => ({ showId: show.id, seatId: s.id, status: 'AVAILABLE' }))
    });
  }

  console.log('✅ Added 7 movies and 8 concerts successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
