/**
 * Test suite for POST /auth/refresh endpoint
 * Tests validation logic + real Firebase flow with actual credentials.
 */

const BASE = 'http://localhost:8000';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

let pass = 0;
let fail = 0;

function report(name, ok, detail) {
  if (ok) { pass++; console.log(`✅ [PASS] ${name}: ${detail}`); }
  else    { fail++; console.error(`❌ [FAIL] ${name}: ${detail}`); }
}

async function run() {
  console.log('🔄 Testing POST /auth/refresh\n');
  console.log('── Validation Tests ──\n');

  // 1. Missing refreshToken → 400
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({})
    });
    const data = await res.json();
    report('Missing refreshToken → 400', res.status === 400,
      `Status ${res.status}, error: ${data.error}`);
  } catch (e) { report('Missing refreshToken', false, e.message); }

  // 2. Empty string refreshToken → 400
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ refreshToken: '' })
    });
    const data = await res.json();
    report('Empty refreshToken → 400', res.status === 400,
      `Status ${res.status}, error: ${data.error}`);
  } catch (e) { report('Empty refreshToken', false, e.message); }

  // 3. Invalid/fake refreshToken → Firebase rejects (400)
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ refreshToken: 'totally-fake-token' })
    });
    const data = await res.json();
    report('Fake token rejected by Firebase', res.status === 400,
      `Status ${res.status}, error: ${data.error}`);
  } catch (e) { report('Fake token rejected', false, e.message); }

  // 4. No Authorization header needed (endpoint is public)
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // NO Bearer token
      body: JSON.stringify({ refreshToken: 'fake-token' })
    });
    // Should get 400 from Firebase (bad token), NOT 401 from auth middleware
    report('No auth header required (not 401)', res.status !== 401,
      `Status ${res.status} (401 would mean auth middleware is blocking)`);
  } catch (e) { report('No auth header required', false, e.message); }

  console.log('\n── Real Firebase Flow ──\n');

  // 5. Register a real test user, then refresh their token
  const testEmail = `test_refresh_${Date.now()}@test.com`;
  const testPassword = 'TestPass123!';

  try {
    // Register
    console.log(`  Registering ${testEmail}...`);
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ email: testEmail, password: testPassword, name: 'Refresh Test' })
    });
    const regData = await regRes.json();

    if (regRes.status !== 201) {
      report('Register test user', false, `Status ${regRes.status}, error: ${JSON.stringify(regData)}`);
      throw new Error('Registration failed, cannot continue');
    }
    report('Register test user', true, `uid: ${regData.uid}`);
    console.log(`  Got refreshToken: ${regData.refreshToken ? regData.refreshToken.substring(0, 20) + '...' : 'NONE'}`);

    // Refresh
    console.log('  Refreshing token...');
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ refreshToken: regData.refreshToken })
    });
    const refreshData = await refreshRes.json();

    const hasAll = refreshData.idToken && refreshData.refreshToken && refreshData.expiresIn;
    report('Refresh with real token → 200', refreshRes.status === 200 && hasAll,
      `Status ${refreshRes.status}, has idToken: ${!!refreshData.idToken}, has refreshToken: ${!!refreshData.refreshToken}, expiresIn: ${refreshData.expiresIn}`);

    // Verify the new idToken works for authenticated requests
    if (refreshData.idToken) {
      console.log('  Verifying new idToken works...');
      const verifyRes = await fetch(`${BASE}/personalities`, {
        headers: { 'Authorization': `Bearer ${refreshData.idToken}`, 'Content-Type': 'application/json' }
      });
      report('New idToken works for API calls', verifyRes.status === 200,
        `GET /personalities returned status ${verifyRes.status}`);
    }

    // Cleanup: delete the test account
    try {
      const token = refreshData.idToken || regData.idToken;
      await fetch(`${BASE}/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      console.log('  🧹 Cleaned up test account');
    } catch (e) {
      console.log('  ⚠️ Could not clean up test account:', e.message);
    }
  } catch (e) {
    if (!e.message.includes('cannot continue')) {
      report('Real Firebase flow', false, e.message);
    }
  }

  // Summary
  console.log(`\n=======================================`);
  console.log(`Refresh Tests: Passed ${pass} | Failed ${fail}`);
  console.log(`=======================================`);
  process.exit(fail === 0 ? 0 : 1);
}

run();
