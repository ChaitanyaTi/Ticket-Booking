# API Documentation

All API endpoints are prefixed with `/api`.
Most endpoints require authentication via a JWT passed in the `Authorization: Bearer <token>` header, marked below as **[Auth]**.

## Auth Module (`/api/auth`)

### `POST /register`
- **Desc**: Register a new user.
- **Body**: `{ name, email, password, role? }`
- **Response**: `{ user: { id, name, email, role }, token }`

### `POST /login`
- **Desc**: Login to get a JWT.
- **Body**: `{ email, password }`
- **Response**: `{ user: { id, name, email, role }, token }`

### `GET /me` **[Auth]**
- **Desc**: Get current user profile.
- **Response**: `{ user: { id, name, email, role } }`

---

## Venues Module (`/api/venues`)

### `GET /` **[Auth]**
- **Desc**: List all venues.
- **Response**: `[{ id, name, address, ... }]`

### `GET /:id` **[Auth]**
- **Desc**: Get venue details.
- **Response**: `{ venue }`

### `POST /` **[Auth]**
- **Desc**: Create a new venue (Admin).
- **Body**: `{ name, address }`
- **Response**: `{ venue }`

### `PATCH /:id` **[Auth]**
- **Desc**: Update a venue (Admin).
- **Body**: `{ name?, address? }`
- **Response**: `{ venue }`

### `DELETE /:id` **[Auth]**
- **Desc**: Delete a venue (Admin).
- **Response**: `204 No Content`

### `POST /:id/categories` **[Auth]**
- **Desc**: Add a seat category to a venue (e.g. VIP).
- **Body**: `{ name, baseLabel }`
- **Response**: `{ category }`

### `GET /:id/categories` **[Auth]**
- **Desc**: List seat categories for a venue.
- **Response**: `[{ id, name, baseLabel }]`

### `POST /:id/seats/bulk` **[Auth]**
- **Desc**: Create seats in bulk.
- **Body**: `{ seats: [{ categoryId, rowLabel, seatNumber, x, y }] }`
- **Response**: `{ count }`

### `POST /:id/seats/grid` **[Auth]**
- **Desc**: Generate a grid of seats automatically.
- **Body**: `{ categoryId, rows, seatsPerRow, startX, startY, gapX, gapY }`
- **Response**: `{ count }`

### `GET /:id/seats` **[Auth]**
- **Desc**: Get all seats for a venue.
- **Response**: `[{ id, categoryId, rowLabel, seatNumber, x, y, category }]`

---

## Events Module (`/api/events`)

### `GET /`
- **Desc**: List public events.
- **Response**: `[{ id, title, description, type, venue, shows }]`

### `GET /:id`
- **Desc**: Get public event details.
- **Response**: `{ event }`

### `GET /organiser/events` **[Auth]**
- **Desc**: List events for the logged-in organiser.
- **Response**: `[{ id, title, type, venue }]`

### `POST /` **[Auth]**
- **Desc**: Create a new event.
- **Body**: `{ title, description, type, venueId }`
- **Response**: `{ event }`

### `PATCH /:id` **[Auth]**
- **Desc**: Update an event.
- **Body**: `{ title?, description?, type?, venueId? }`
- **Response**: `{ event }`

### `DELETE /:id` **[Auth]**
- **Desc**: Delete an event.
- **Response**: `204 No Content`

### `POST /:id/shows` **[Auth]**
- **Desc**: Add a show/occurrence to an event.
- **Body**: `{ date, time }`
- **Response**: `{ show, seatsCreated }`

### `GET /:eventId/shows`
- **Desc**: List shows for an event.
- **Response**: `[{ id, date, time, status }]`

---

## Shows Module (`/api/shows`)

### `GET /:id/seatmap`
- **Desc**: Get the interactive seat map with current seat availability.
- **Response**: `{ show, seats, pricing }`

### `POST /:id/hold` **[Auth]**
- **Desc**: Hold seats temporarily for checkout.
- **Body**: `{ seatIds: [string] }`
- **Response**: `{ holdId, seats, expiresAt }`

### `DELETE /holds/:holdId` **[Auth]**
- **Desc**: Release a held seat.
- **Response**: `{ success: true }`

### `POST /:id/book` **[Auth]**
- **Desc**: Confirm a booking from held seats.
- **Body**: `{ holdId }`
- **Response**: `{ booking: { id, bookingRef, totalAmount } }`

### `GET /:id/summary` **[Auth]**
- **Desc**: Get analytics for an organiser (bookings, revenue, per-category breakdown).
- **Response**: `{ show, stats, categoryStats, bookings }`

### `POST /:id/pricing` **[Auth]**
- **Desc**: Set pricing for a single seat category.
- **Body**: `{ categoryId, price }` (price in cents)
- **Response**: `{ pricing }`

### `POST /:id/pricing/bulk` **[Auth]**
- **Desc**: Set pricing for multiple categories at once.
- **Body**: `{ pricing: [{ categoryId, price }] }`
- **Response**: `{ updated }`

---

## Bookings Module (`/api/bookings`)

### `GET /me` **[Auth]**
- **Desc**: List bookings for the current user.
- **Response**: `[{ id, bookingRef, status, totalAmount, show, seats }]`

---

## Waitlist Module (`/api`)

### `POST /shows/:id/waitlist` **[Auth]**
- **Desc**: Join the waitlist for a specific show and seat category.
- **Body**: `{ categoryId }`
- **Response**: `{ entry: { id, position, status } }`

### `GET /waitlist/me` **[Auth]**
- **Desc**: List user's active waitlist entries.
- **Response**: `[{ id, show, category, position, status }]`

### `GET /waitlist-offers/:token`
- **Desc**: Fetch a time-limited waitlist offer via magic link token.
- **Response**: `{ offer: { id, expiresAt, showSeat, waitlistEntry } }`

### `POST /waitlist-offers/:token/accept` **[Auth]**
- **Desc**: Accept a waitlist offer and convert to a booking.
- **Response**: `{ booking }`

### `DELETE /bookings/:bookingId` **[Auth]**
- **Desc**: Cancel a booking. This automatically triggers the waitlist auto-assignment flow.
- **Response**: `{ success: true }`

### `POST /internal/waitlist-offers/:token/expire`
- **Desc**: Internal route triggered by TTL sweeper to forcefully expire an offer and pass the seat to the next person in line.
- **Response**: `{ success: true }`
