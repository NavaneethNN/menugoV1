import dotenv from 'dotenv';
dotenv.config();

/**
 * Production Deployment Smoke Test Script
 * Usage:
 *   npx tsx scripts/smoke-test.ts
 *   npx tsx scripts/smoke-test.ts --url https://api.yourdomain.com
 */

function getTargetUrl(): string {
  const urlArg = process.argv.find((arg) => arg.startsWith('--url='));
  if (urlArg) return urlArg.split('=')[1];

  const urlIdx = process.argv.indexOf('--url');
  if (urlIdx !== -1 && process.argv[urlIdx + 1]) {
    return process.argv[urlIdx + 1];
  }

  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
}

const targetUrl = getTargetUrl().replace(/\/$/, '');

console.log('================================================');
console.log(`🩺 MenuGo Production Smoke Test Runner`);
console.log(`🎯 Target API URL: ${targetUrl}`);
console.log('================================================\n');

interface TestResult {
  name: string;
  passed: boolean;
  status?: number;
  durationMs: number;
  error?: string;
}

const results: TestResult[] = [];

async function runCheck(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`✅ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ name, passed: false, durationMs, error: err.message });
    console.log(`❌ [FAIL] ${name} (${durationMs}ms): ${err.message}`);
  }
}

async function main() {
  // 1. Health Liveness Probe
  await runCheck('1. Health Liveness Probe (/api/health/live)', async () => {
    const res = await fetch(`${targetUrl}/api/health/live`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const data: any = await res.json();
    if (data.status !== 'live') {
      throw new Error(`Expected status "live", got "${data.status}"`);
    }
  });

  // 2. Health Readiness Probe (DB Check)
  await runCheck('2. Health Readiness Probe (/api/health/ready)', async () => {
    const res = await fetch(`${targetUrl}/api/health/ready`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const data: any = await res.json();
    if (data.status !== 'ready' || data.database !== 'connected') {
      throw new Error(`Database connection failed or not ready: ${JSON.stringify(data)}`);
    }
  });

  // 3. Auth Rejection Security Smoke Check
  await runCheck('3. Unauthenticated Session Rejection (/api/auth/me)', async () => {
    const res = await fetch(`${targetUrl}/api/auth/me`);
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 Unauthorized, got ${res.status}`);
    }
  });

  // 4. Invalid Login Sanitization
  await runCheck('4. Invalid Login Rejection & Sanitization', async () => {
    const res = await fetch(`${targetUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': targetUrl
      },
      body: JSON.stringify({
        email: 'smoke-nonexistent@example.com',
        password: 'SmokePassword123!'
      })
    });
    if (![400, 401].includes(res.status)) {
      throw new Error(`Expected HTTP 400 or 401, got ${res.status}`);
    }
  });

  // 5. Public Restaurant Menu Lookup (Invalid Slug)
  await runCheck('5. Public Restaurant Menu 404 Handling', async () => {
    const res = await fetch(`${targetUrl}/api/restaurants/by-slug/smoke-nonexistent-restaurant-9999`);
    if (res.status !== 404) {
      throw new Error(`Expected HTTP 404 Not Found, got ${res.status}`);
    }
  });

  // 6. Table Token Verification (Malformed & Not Found)
  await runCheck('6. Invalid Table QR Token Rejection (Malformed: 400)', async () => {
    const res = await fetch(`${targetUrl}/api/tables/verify/smoke-invalid-qr-token-1234567890`);
    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400 Bad Request, got ${res.status}`);
    }
  });

  await runCheck('7. Unassigned Table QR Token Rejection (48-hex: 404)', async () => {
    const res = await fetch(`${targetUrl}/api/tables/verify/0123456789abcdef0123456789abcdef0123456789abcdef`);
    if (res.status !== 404) {
      throw new Error(`Expected HTTP 404 Not Found, got ${res.status}`);
    }
  });

  // 8. Cinema Protected API Route Authentication Smoke Check
  await runCheck('8. Cinema Protected Route Rejects Unauthenticated Callers (/api/cinema/screens)', async () => {
    const res = await fetch(`${targetUrl}/api/cinema/screens`);
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 Unauthorized, got ${res.status}`);
    }
  });

  // 9. Cinema Public Theatre Lookup
  await runCheck('9. Cinema Public Theatre QR Lookup (Nonexistent Token: 404)', async () => {
    const res = await fetch(`${targetUrl}/api/cinema/public/theatres/smoke-nonexistent-token-xyz`);
    if (res.status !== 404) {
      throw new Error(`Expected HTTP 404 Not Found, got ${res.status}`);
    }
  });

  // 10. Cinema Payment Webhook Endpoint Reachability
  await runCheck('10. Cinema Payment Webhook Rejection for Unknown Theatre (404)', async () => {
    const fakeTheatreId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${targetUrl}/api/cinema/payments/webhook/${fakeTheatreId}/paytm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ORDERID: 'smoke-test-order-1' })
    });
    if (res.status !== 404) {
      throw new Error(`Expected HTTP 404 Not Found, got ${res.status}`);
    }
  });

  // Summary
  console.log('\n================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Summary: ${passedCount}/${results.length} checks passed.`);
  if (failedCount > 0) {
    console.log(`⚠️ ${failedCount} checks failed!`);
    process.exit(1);
  } else {
    console.log(`🎉 All deployment smoke checks passed successfully!`);
    console.log('================================================');
  }
}

main().catch((err) => {
  console.error('Fatal smoke test runner error:', err);
  process.exit(1);
});
