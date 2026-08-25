# Ticket Booking System

A full-stack ticket booking platform designed to handle real-world ticket booking workflows with a strong focus on **seat inventory consistency, concurrency control, temporary seat holds, waitlist allocation, and real-time updates**.

The application allows customers to browse events, select seats, temporarily hold them during checkout, complete bookings, cancel bookings, and join a waitlist when seats are unavailable. Organisers can manage events and shows, while administrators can manage venues.

---

## Live Project

- **Frontend:** https://ticket-booking-alpha-bice.vercel.app/
- **GitHub Repository:** https://github.com/ChaitanyaTi/Ticket-Booking
- **Backend:** Deployed on Render

---

## 🔐 Test Credentials

The database seed script creates several test accounts with different roles. You can use these to test the application locally.

**All accounts use the same password:** `Password123!`

### Administrator
* **Email:** `admin@demo.com`

### Organisers (Event Creators)
* **Email 1:** `organiser1@demo.com` (LiveNation)
* **Email 2:** `organiser2@demo.com` (Indie Events)

### Customers (Ticket Buyers)
* **Email 1:** `customer1@demo.com`
* **Email 2:** `customer2@demo.com`
* **Email 3:** `customer3@demo.com`

> **Note:** You can also create new customer or organiser accounts by using the Sign Up page in the application. However, the admin account mentioned above is the only way to access administrator privileges.

---

## Features

- User registration and login using JWT authentication
- Role-based access for Customer, Organiser, and Admin
- Event management
- Show management
- Venue management
- Interactive seat map
- Temporary seat holds
- Automatic expiration of expired seat holds
- Booking confirmation
- Booking history
- Booking cancellation
- Waitlist management
- Automatic waitlist allocation
- Time-limited waitlist offers
- SMTP email notifications
- QR-code based booking/ticket information
- Real-time seat availability using Socket.IO
- PostgreSQL database using Prisma ORM
- Redis integration
- Background processing for expired holds and offers
- Concurrency-safe seat booking
- Concurrency-safe waitlist allocation
- Concurrency-safe waitlist offer acceptance

---

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Socket.IO Client

### Backend
- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Redis
- Socket.IO
- JWT

### Email
- SMTP

### Deployment
- Vercel
- Render

---

## System Architecture

```
                         +----------------------+
                         |      React App       |
                         | React + TypeScript   |
                         +----------+-----------+
                                    |
                         REST API / Socket.IO
                                    |
                                    v
                         +----------------------+
                         |      Backend API     |
                         | Node + Express + TS  |
                         +----------+-----------+
                                    |
                 +------------------+------------------+
                 |                  |                  |
                 v                  v                  v
        +----------------+  +--------------+  +--------------+
        |   PostgreSQL   |  |    Redis     |  |     SMTP     |
        |     Prisma     |  |              |  |    Email     |
        +----------------+  +--------------+  +--------------+
```

The backend is organised into independent modules for authentication, events, shows, venues, bookings, waitlists, and email.

---

## Core Booking Flow

A seat follows the following lifecycle:

```
AVAILABLE
    |
    v
  HELD
    |
    +----------------+
    |                |
    v                v
 BOOKED           EXPIRED
                     |
                     v
                 AVAILABLE
```

When a customer selects an available seat, the backend attempts to place it in the `HELD` state.

The seat remains temporarily held while the customer completes checkout.

- If the booking succeeds: `HELD -> BOOKED`
- If the hold expires before booking: `HELD -> AVAILABLE`

This prevents abandoned checkouts from permanently blocking seats.

---

## Concurrency Control

Concurrency handling is one of the primary design considerations of the system.

The most important race condition is when two users attempt to reserve the same seat simultaneously.

```
User A ------------------+
                          |
                          v
                      Same Seat
                          |
                          v
                  Database Transaction
                          ^
                          |
User B ------------------+
                          |
                          v
                 PostgreSQL Serialization
                          |
                  +-------+-------+
                  |               |
                  v               v
              One succeeds    One fails
```

Critical seat operations are executed using database transactions with PostgreSQL Serializable isolation.

This ensures that two concurrent transactions cannot both successfully reserve the same seat.

The system therefore prevents:

- Double seat booking
- Duplicate seat holds
- Inconsistent seat states
- Incorrect inventory after concurrent requests

---

## Temporary Seat Holds

A selected seat is not immediately treated as a confirmed booking. Instead, the seat is temporarily held for the customer.

The hold stores information such as:

- User
- Seat
- Show
- Hold expiration time
- Current seat state

The hold has a limited lifetime. A background process periodically checks for expired holds and releases their seats.

This ensures that seats are automatically returned to the available inventory when a customer abandons checkout.

---

## Booking Cancellation

When a confirmed booking is cancelled, the system first releases the associated seats.

```
BOOKED
   |
   v
CANCELLED
   |
   v
AVAILABLE
   |
   v
Waitlist Processing
```

The seat release is completed before waitlist allocation is triggered. This ordering prevents the waitlist process from attempting to allocate a seat before it has actually become available.

---

## Waitlist System

When seats are unavailable, customers can join the waitlist. Waitlist entries are maintained in chronological order.

```
Customer 1 -> WAITING
Customer 2 -> WAITING
Customer 3 -> WAITING
```

When a seat becomes available, the earliest eligible waiting customer is selected.

```
Seat Released
     |
     v
Find earliest WAITING entry
     |
     v
Claim entry
     |
     v
Create OFFER
     |
     v
Notify customer
```

This provides fair, queue-based allocation.

### Waitlist Concurrency

Multiple seats can become available at the same time, which can cause multiple processes to attempt to claim the same waitlist entry.

To handle this, waitlist entries are claimed using conditional updates. The state transition is effectively:

```
WAITING -> OFFERED
```

The update succeeds only if the entry is still `WAITING`. If another process has already claimed the entry, the conditional update affects zero rows and the current process retries with the next eligible entry.

This prevents:

- Duplicate waitlist offers
- Multiple processes claiming the same user
- Incorrect waitlist ordering

### Waitlist Offer Acceptance

A waitlist offer is valid only for a limited period. The offer lifecycle is:

```
WAITING
   |
   v
OFFERED
   |
   +----------------+
   |                |
   v                v
ACCEPTED         EXPIRED
   |                |
   v                v
BOOKED        Next Waitlist User
```

When the customer accepts an offer, the backend verifies:

- The offer exists
- The offer is still pending
- The offer has not expired
- The seat is still held for the intended user
- The offer has not already been accepted

The offer is then conditionally changed from:

```
PENDING -> ACCEPTED
```

Only the request that successfully performs this transition can continue with the booking.

This prevents duplicate bookings caused by:

- Multiple clicks
- Browser retries
- Concurrent requests
- Reusing an already accepted offer

### Expired Waitlist Offers

If a customer does not accept the offer before it expires, the offer is marked as expired. The seat is then made available for the next eligible waitlisted customer.

```
OFFERED
   |
   v
EXPIRED
   |
   v
Seat Released
   |
   v
Next WAITING Customer
```

This prevents seats from remaining locked because a waitlisted customer did not respond.

---

## Real-Time Seat Updates

Socket.IO is used to provide real-time seat availability updates.

Important seat state changes can be broadcast to connected clients, including:

- Seat held
- Seat booked
- Seat released
- Hold expired
- Waitlist allocation

This allows multiple users viewing the same show to receive updated seat information without manually refreshing the page.

---

## Background Processing

The backend contains background processing for time-dependent operations. The main jobs include:

- Detecting expired seat holds
- Releasing expired holds
- Detecting expired waitlist offers
- Expiring offers
- Triggering the next waitlist allocation

These processes ensure that temporary resources are automatically cleaned up.

The relevant implementation is located in `backend/src/jobs/`.

---

## Email Notifications

The application uses SMTP for email notifications. SMTP is used for relevant booking and waitlist communication, including waitlist offer notifications.

Email credentials are provided through environment variables and are not hard-coded into the application. Production credentials are stored in the deployment environment and are not committed to GitHub.

---

## QR Code

The booking system supports QR-code based ticket/booking information. The generated QR information is associated with the confirmed booking and can be used as part of the ticket verification flow.

---

## Project Structure

```
Ticket-Booking/
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── bookings/
│   │   │   ├── email/
│   │   │   ├── events/
│   │   │   ├── shows/
│   │   │   ├── venues/
│   │   │   └── waitlist/
│   │   └── utils/
│   │
│   ├── package.json
│   ├── render.yaml
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── store/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── API_DOCS.md
│   ├── DB_SCHEMA.md
│   ├── README.md
│   └── SYSTEM_DESIGN.md
│
└── .gitignore
```

---

## Local Setup

### Prerequisites

Install:

- Node.js
- npm
- PostgreSQL
- Redis

### Clone Repository

```bash
git clone https://github.com/ChaitanyaTi/Ticket-Booking.git
cd Ticket-Booking
```

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example`. Configure the required environment variables:

```env
DATABASE_URL=your_postgresql_connection_string
REDIS_URL=your_redis_connection_string
JWT_SECRET=your_jwt_secret
GMAIL_USER=your_smtp_email
GMAIL_APP_PASSWORD=your_smtp_app_password
FRONTEND_URL=http://localhost:5173
APP_URL=http://localhost:5173
```

Generate Prisma Client:

```bash
npx prisma generate
```

Apply the database schema:

```bash
npx prisma db push
```

Start the development server:

```bash
npm run dev
```

### Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file using `.env.example` and configure the backend API URL.

```bash
npm run dev
```
