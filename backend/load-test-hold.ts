#!/usr/bin/env tsx
/**
 * Concurrency Load Test for Seat Hold
 *
 * This script fires N concurrent hold requests for the SAME seat
 * and verifies that EXACTLY 1 succeeds (the rest fail with conflict).
 *
 * Usage: npx tsx load-test-hold.ts <showId> <seatId> [concurrency=20]
 */

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const API_BASE = process.env.API_BASE || 'http://localhost:4000';

async function getTestUser(): Promise<{ id: string; token: string }> {
  // Create or get a test user
  let user = await prisma.user.findFirst({
    where: { email: 'loadtest@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Load Test User',
        email: 'loadtest@example.com',
        passwordHash: '$2a$12$dummy', // Not used for JWT auth
        role: 'CUSTOMER',
      },
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { id: user.id, token };
}

async function holdSeat(showId: string, seatId: string, token: string): Promise<{ success: boolean; status: number; data?: any; error?: any }> {
  try {
    const response = await fetch(`${API_BASE}/api/shows/${showId}/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ seatIds: [seatId] }),
    });

    const data = await response.json();
    return { success: response.ok, status: response.status, data, error: data };
  } catch (error) {
    return { success: false, status: 0, error: String(error) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npx tsx load-test-hold.ts <showId> <seatId> [concurrency=20]');
    process.exit(1);
  }

  const [showId, seatId] = args;
  const concurrency = parseInt(args[2] || '20', 10);

  console.log(`\n🔬 Concurrency Load Test`);
  console.log(`   Show ID: ${showId}`);
  console.log(`   Seat ID: ${seatId}`);
  console.log(`   Concurrency: ${concurrency} parallel requests\n`);

  // Verify show and seat exist
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) {
    console.error('❌ Show not found');
    process.exit(1);
  }

  const showSeat = await prisma.showSeat.findUnique({ where: { id: seatId } });
  if (!showSeat || showSeat.showId !== showId) {
    console.error('❌ Seat not found for this show');
    process.exit(1);
  }

  // Ensure seat is available
  if (showSeat.status !== 'AVAILABLE') {
    console.log(`⚠️  Seat is ${showSeat.status}, resetting to AVAILABLE...`);
    await prisma.showSeat.update({
      where: { id: seatId },
      data: { status: 'AVAILABLE', heldByUserId: null, heldAt: null, holdExpiresAt: null },
    });
  }

  const { token } = await getTestUser();

  console.log(`🚀 Firing ${concurrency} concurrent requests...\n`);

  const startTime = Date.now();
  const promises = Array(concurrency).fill(null).map((_, i) => holdSeat(showId, seatId, token));
  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;

  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const conflicts = failed.filter(r => r.status === 409);
  const otherErrors = failed.filter(r => r.status !== 409);

  console.log(`📊 Results (${duration}ms):`);
  console.log(`   ✅ Successful: ${successful.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  console.log(`      - 409 Conflict (expected): ${conflicts.length}`);
  console.log(`      - Other errors: ${otherErrors.length}`);

  if (otherErrors.length > 0) {
    console.log('\n⚠️  Other errors:');
    otherErrors.forEach((e, i) => console.log(`   ${i + 1}. Status: ${e.status}, Error:`, e.error));
  }

  // Verify exactly 1 success
  const passed = successful.length === 1 && conflicts.length === concurrency - 1;
  console.log(`\n${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}: Exactly 1 request should succeed`);
  console.log(`   Expected: 1 success, ${concurrency - 1} conflicts`);
  console.log(`   Actual:   ${successful.length} success, ${conflicts.length} conflicts`);

  if (successful.length > 0) {
    console.log('\n📋 Successful response:');
    console.log(JSON.stringify(successful[0].data, null, 2));
  }

  // Cleanup: release the hold if test passed
  if (passed && successful[0].data?.data?.holdId) {
    const holdId = successful[0].data.data.holdId;
    console.log(`\n🧹 Cleaning up hold ${holdId}...`);
    // Note: The hold will auto-expire via TTL, but we can also release manually
  }

  await prisma.$disconnect();
  process.exit(passed ? 0 : 1);
}

main().catch(async (err) => {
  console.error('💥 Test error:', err);
  await prisma.$disconnect();
  process.exit(1);
});