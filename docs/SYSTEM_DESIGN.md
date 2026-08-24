# System Design

This document outlines the architectural decisions powering the critical paths of the ticket booking engine, specifically focusing on concurrency, seat holds, and the waitlist flow.

## 1. Concurrency Prevention

The core challenge in a high-traffic ticketing system is preventing "double-booking" when hundreds of users attempt to select the same seat simultaneously. 

We solve this entirely at the database level using **Row-Level Locking** within a strictly isolated transaction. When a request hits the `POST /api/shows/:id/hold` endpoint:
1. The backend opens a database transaction using Prisma's `Serializable` isolation level.
2. It fetches the requested `ShowSeat` records.
3. If any seat's status is not `AVAILABLE`, the transaction immediately aborts.
4. It updates the seats to `HELD`.

Because of the `Serializable` isolation level, the underlying PostgreSQL database prevents race conditions. If two concurrent requests try to lock the exact same `ShowSeat` row at the exact same millisecond, Postgres throws a write conflict (`P2034` in Prisma). The backend intercepts this conflict and gracefully returns a `409 Conflict` HTTP response to the losing request. The load-test script in this repository actively proves that out of 20 concurrent identical requests, exactly 1 succeeds and 19 fail safely without data corruption.

## 2. Seat Hold and TTL Mechanism

To prevent users from hoarding tickets in their cart without buying them, the system enforces a strict Time-To-Live (TTL) on held seats.

When a seat is successfully held, the `ShowSeat` is updated with `heldByUserId`, `heldAt` (current time), and `holdExpiresAt` (current time + 10 minutes, configurable via `HOLD_TTL_MINUTES`).

**The Cleanup Loop**:
A background worker (running via `setInterval` in the Node.js backend) acts as a sweeper. Every 60 seconds, it queries for all `ShowSeat` records where `status = 'HELD'` and `holdExpiresAt < NOW()`. 
- These seats are instantly bulk-updated back to `AVAILABLE`, stripping the `heldByUserId`.
- Real-time Socket.io events (`seat:released`) are broadcast to all clients currently viewing that show's seat map, causing the seat to instantly turn green on their screens without requiring a page refresh.

## 3. Waitlist Auto-Assignment Flow

When a specific seat category (e.g., "VIP") sells out, users can opt into a waitlist. Their request is logged in the `WaitlistEntry` table with a 1-based `position` representing their place in the queue.

The auto-assignment is deeply integrated into the seat release mechanisms. A seat can become available either because a cart TTL expired, or because a user explicitly released it. When a seat becomes available:
1. The system checks the `WaitlistEntry` table for users waiting for that specific `showId` and `categoryId` with `status = 'WAITING'`.
2. It queries for the user with the lowest `position` (the first person in line).
3. If a match is found, the system *does not* make the seat available to the public. Instead, it creates a `WaitlistOffer`.

## 4. Time-Limited Offer Handling

A `WaitlistOffer` represents an exclusive right to purchase a freed-up ticket. 

1. **Offer Creation**: The system generates a unique, unguessable `offerToken` (UUID) and creates a `WaitlistOffer` record linking the user's `WaitlistEntry` to the specific `ShowSeat`. The `WaitlistEntry` status updates to `OFFERED`.
2. **TTL Enforcement**: The offer has an `expiresAt` timestamp (15 minutes, configurable via `WAITLIST_OFFER_TTL_MINUTES`). The system automatically fires an email to the user (via Resend) containing a link with the unique token: `/waitlist/:token`.
3. **Acceptance**: When the user clicks the link, the frontend calls `GET /waitlist-offers/:token` to validate it, rendering a checkout screen. If they accept, `POST /waitlist-offers/:token/accept` completes the transaction, marking the offer `ACCEPTED` and generating a formal `Booking`.
4. **Expiry**: Just like seat holds, a background sweeper checks for `PENDING` offers where `expiresAt < NOW()`. If an offer expires, it is marked `EXPIRED`, the user's `WaitlistEntry` is marked `EXPIRED`, and the seat goes back through the auto-assignment flow—automatically being offered to the *next* person in the queue. If the queue is empty, the seat is finally released to the general public.
