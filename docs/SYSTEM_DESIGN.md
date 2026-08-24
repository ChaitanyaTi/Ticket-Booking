# System Design

This document describes the architecture and correctness mechanisms used in the ticket booking system, with particular focus on seat holds, TTL-based expiry, concurrency prevention, waitlist assignment, and time-limited waitlist offers.

## 1. Concurrency Prevention

The primary concurrency problem is preventing two users from successfully holding or booking the same seat at the same time.

When a user requests a seat hold, the backend performs the operation inside a Prisma database transaction using PostgreSQL's `Serializable` transaction isolation level.

The transaction:

1. Identifies the requested `ShowSeat` records.
2. Verifies that every requested seat is currently `AVAILABLE`.
3. Updates the seats to `HELD`.
4. Records the user holding the seats and the hold expiration time.

Because the transaction uses `Serializable` isolation, conflicting concurrent transactions cannot both successfully commit. PostgreSQL detects the serialization conflict and one transaction fails. The backend handles Prisma's serialization conflict (`P2034`) and returns an appropriate conflict response.

This ensures that two users cannot successfully hold the same seat simultaneously and prevents duplicate seat allocation.

The repository also contains a concurrency/load-test script that can be used to verify this behavior by sending multiple simultaneous requests for the same seat. The expected result is that only one request succeeds while the remaining requests fail safely without creating duplicate holds or bookings.

## 2. Seat Hold and TTL Mechanism

A seat selected during checkout is temporarily held rather than immediately becoming permanently booked.

When a hold is created, the corresponding `ShowSeat` record stores:

- `status = HELD`
- `heldByUserId`
- `heldAt`
- `holdExpiresAt`

The hold duration is configurable through `HOLD_TTL_MINUTES`. This prevents users from keeping seats reserved indefinitely without completing the booking process.

A background cleanup process periodically searches for expired holds. When a held seat has passed its `holdExpiresAt` timestamp, the system releases it by changing its status back to `AVAILABLE` and clearing the hold ownership information.

After a hold is released, the system emits a Socket.IO event so connected clients viewing the seat map can receive the updated seat status in real time without requiring a page refresh.

If the released seat has eligible waitlisted users, the waitlist allocation flow is triggered instead of immediately exposing the seat to the general public.

This provides both automatic inventory recovery and real-time seat availability updates.

## 3. Waitlist Auto-Assignment

When seats of a particular category are unavailable, users can join the waitlist for that show and category.

Each waitlist request is stored as a `WaitlistEntry` with a queue position and a status such as `WAITING` or `OFFERED`.

When a seat becomes available because of booking cancellation or expiration of a seat hold, the system checks for the earliest eligible `WAITING` entry for the same show and seat category.

The allocation process is performed transactionally:

1. Find the earliest eligible waiting entry.
2. Atomically claim the waitlist entry by changing its status from `WAITING` to `OFFERED`.
3. Atomically transition the released seat from `AVAILABLE` to `HELD`.
4. Create a `WaitlistOffer` for that user and seat.
5. Send the user an email notification through the application's SMTP email service.

Optimistic concurrency checks ensure that if multiple seat releases attempt to process the same waitlist entry simultaneously, only one transaction can successfully claim it. If another transaction has already claimed the entry, the failed attempt retries the allocation process and selects the next eligible entry.

This prevents duplicate offers and preserves the chronological ordering of the waitlist.

## 4. Time-Limited Waitlist Offers

A `WaitlistOffer` gives a specific waitlisted user a temporary opportunity to purchase an available seat.

When an offer is created:

- A unique offer token is generated.
- The waitlist entry changes from `WAITING` to `OFFERED`.
- The offer stores an `expiresAt` timestamp.
- The seat is reserved for that offer.
- An email notification is sent through the application's SMTP email service.
- The email contains a unique link to the waitlist offer.

The offer duration is configurable through `WAITLIST_OFFER_TTL_MINUTES`.

When the user accepts the offer, the backend validates the token and expiration and performs the acceptance inside a database transaction. The offer is conditionally changed from `PENDING` to `ACCEPTED`, and the corresponding seat is verified as being held by the intended user before the booking is created.

The conditional update makes the acceptance operation concurrency-safe. If multiple requests attempt to accept the same offer simultaneously, only the request that successfully claims the pending offer can proceed to create the booking. This prevents duplicate bookings caused by repeated clicks or concurrent requests.

A background worker checks for expired offers. When an offer expires, it is marked as `EXPIRED` and the associated waitlist entry is updated accordingly. The seat is then passed back through the waitlist allocation process so the next eligible waiting user can receive the opportunity.

If no eligible waitlisted user remains, the seat becomes available to the general public.

This design ensures that released inventory is handled consistently while providing fair, chronological, and time-limited opportunities to waitlisted customers.