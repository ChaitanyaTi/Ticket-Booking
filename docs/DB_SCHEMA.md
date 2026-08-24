# Database Schema

The system uses Prisma ORM with a PostgreSQL database. Below is a breakdown of the models, relationships, and the critical indices/constraints that power the concurrent booking engine.

## Core Models

### `User`
Stores users of all types.
- **Fields**: `id`, `name`, `email` (unique), `passwordHash`, `role` (`CUSTOMER`, `ORGANISER`, `ADMIN`)
- **Relations**: Organises Events, has Bookings, WaitlistEntries, and WaitlistOffers.

### `Venue`, `SeatCategory`, and `Seat`
Represents physical locations and their layout.
- **`Venue`**: The physical location (e.g., "Grand Arena").
- **`SeatCategory`**: Logical groupings of seats at a venue (e.g., "VIP", "Standard"). Has a `baseLabel` (e.g., "V").
  - *Constraint*: `@@unique([venueId, name])` ensures category names don't collide in a single venue.
- **`Seat`**: A physical, persistent seat within a venue.
  - **Fields**: `rowLabel`, `seatNumber`, `x`, `y` (for rendering the grid layout).
  - *Constraint*: `@@unique([venueId, rowLabel, seatNumber])` ensures no duplicate physical seats exist.

### `Event` and `Show`
- **`Event`**: The logical event (e.g., "The Eras Tour"). Tied to an Organiser and a Venue.
- **`Show`**: A specific date/time occurrence of an Event. 

## Ticketing & Concurrency Models

### `ShowSeat` (The Core Concurrency Anchor)
Represents a specific physical seat for a specific show occurrence. This is the entity that gets locked during the booking process.
- **Fields**: 
  - `status`: `AVAILABLE`, `HELD`, `BOOKED`.
  - `heldByUserId`, `heldAt`, `holdExpiresAt`.
- **Concurrency Constraints**:
  - `@@unique([showId, seatId])`: Guarantees exactly one state machine instance per physical seat per show.
  - **Row-Level Locking**: When a user attempts to hold a seat, the backend transaction uses `Serializable` isolation to lock this exact row. If another transaction tries to modify it simultaneously, Postgres throws a conflict (mapped to a 409 API response), preventing double-booking.
- **Indexes**: `@@index([showId, status])` for fast queries of available seats; `@@index([holdExpiresAt])` for background TTL cleanup jobs.

### `ShowSeatPricing`
Dynamic pricing per category, per show.
- **Fields**: `showId`, `categoryId`, `price` (in cents/paise).
- *Constraint*: `@@unique([showId, categoryId])` prevents overlapping pricing rules.

### `Booking` and `BookingSeat`
- **`Booking`**: A completed transaction.
  - **Fields**: `bookingRef` (unique, generated), `status`, `totalAmount`.
- **`BookingSeat`**: Join table mapping a `Booking` to multiple `ShowSeat` records.
  - *Constraint*: `@@unique([bookingId, showSeatId])` ensures a seat is only attached to a booking once.

## Waitlist Models

### `WaitlistEntry`
Represents a user waiting for a ticket in a specific category for a sold-out show.
- **Fields**: `status` (`WAITING`, `OFFERED`, etc.), `position` (queue order).
- *Constraint*: `@@unique([showId, categoryId, userId])` prevents a user from joining the same waitlist twice.
- *Index*: `@@index([showId, categoryId, status, position])` heavily optimizes finding the next person in line when a ticket frees up.

### `WaitlistOffer`
Represents a time-limited offer extended to a waitlist user when a seat becomes available.
- **Fields**: `offerToken` (unique UUID for secure linking), `expiresAt`, `status`.
- **Relations**: Points to the specific `WaitlistEntry` and the freed up `ShowSeat`.
- *Index*: `@@index([expiresAt])` to quickly sweep and expire ignored offers.
