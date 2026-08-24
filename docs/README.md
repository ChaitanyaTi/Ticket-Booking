# Ticket Booking System

A full-stack, highly concurrent seat-booking engine built for high-traffic ticket sales. The system is designed to prevent race conditions during checkout using row-level database locking and strict transactional integrity.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma (PostgreSQL), Redis (for Socket.io state), Socket.io (real-time seat state broadcasting)
- **Frontend**: React (Vite), TypeScript, TailwindCSS, Zustand, Recharts, Socket.io-client

## Project Setup

### 1. Clone & Dependencies
Clone the repository, then install dependencies for both backend and frontend:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment Variables
Copy the `.env.example` files to `.env` in both directories and update the variables.
```bash
# In backend/
cp .env.example .env

# In frontend/
cp .env.example .env
```
Ensure you have a PostgreSQL database and Redis server running. Update the `DATABASE_URL` and `REDIS_HOST`/`REDIS_PORT` in `backend/.env`.

### 3. Database Migration & Seeding
Push the schema to the database and generate the Prisma Client:
```bash
cd backend
npx prisma migrate dev
```
To populate the database with realistic demo data, including venues, events, and bookings, run the seed script:
```bash
npm run prisma:seed
```

### 4. Demo Accounts
The seed script provisions several accounts with realistic data. You can log in using the following credentials without registering:

**Password for all accounts:** `Password123!`

| Role | Email |
| :--- | :--- |
| **Admin** | `admin@demo.com` |
| **Organiser** | `organiser1@demo.com`<br>`organiser2@demo.com` |
| **Customer** | `customer1@demo.com`<br>`customer2@demo.com`<br>`customer3@demo.com` |

### 5. Running Locally
You will need to run the backend and frontend simultaneously.
**Backend**:
```bash
cd backend
npm run dev
```
**Frontend**:
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`. 
The backend API will run at `http://localhost:4000`.

## Testing Concurrency
A core feature of the system is absolute prevention of double-booking. To verify this, a concurrency load test script is provided that fires 20 parallel requests for the exact same seat at the exact same millisecond.

To run the load test:
1. Ensure your backend is running.
2. Ensure you have seeded the database (which creates a test show and seats).
3. Run the load test from the `backend/` directory, providing a valid Show ID and ShowSeat ID:

```bash
cd backend
npx tsx load-test-hold.ts <showId> <showSeatId> 20
```

*You can retrieve the `showId` and `showSeatId` from the database directly, or check the terminal output from `npx prisma db seed`, which logs a test Show ID you can use.*

### Expected Results
The script asserts that exactly **1** request succeeds, and the other 19 fail with a `409 Conflict`. 

```
🔬 Concurrency Load Test
   Show ID: test_show_...
   Seat ID: cmt4wt8...
   Concurrency: 20 parallel requests

🚀 Firing 20 concurrent requests...

📊 Results (3355ms):
   ✅ Successful: 1
   ❌ Failed: 19
      - 409 Conflict (expected): 19
      - Other errors: 0

✅ TEST PASSED: Exactly 1 request should succeed
   Expected: 1 success, 19 conflicts
   Actual:   1 success, 19 conflicts
```
