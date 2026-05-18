/**
 * MindDialogue - Complete API Integration Test Suite
 * This script tests every single route and endpoint of the MindDialogue Express Backend.
 */



const BASE_URL = 'http://localhost:8000';
const AUTH_HEADER = {
  'Authorization': 'Bearer dev-user-123',
  'Content-Type': 'application/json'
};

const results = [];
let passCount = 0;
let failCount = 0;

function report(endpoint, success, details) {
  if (success) {
    passCount++;
    console.log(`✅ [PASS] ${endpoint}: ${details}`);
    results.push({ endpoint, success: true, details });
  } else {
    failCount++;
    console.error(`❌ [FAIL] ${endpoint}: ${details}`);
    results.push({ endpoint, success: false, details });
  }
}

async function runTests() {
  console.log('🚀 Starting MindDialogue Complete API Integration Tests...\n');
  
  let tempSessionId = '';
  
  // 1. Health check `/`
  try {
    const res = await fetch(`${BASE_URL}/`);
    const data = await res.json();
    if (res.status === 200 && data.status === 'ok') {
      report('GET / (Health Check)', true, `Uptime: ${data.uptime}s, Version: ${data.version}`);
    } else {
      report('GET / (Health Check)', false, `Status ${res.status}, payload: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    report('GET / (Health Check)', false, err.message);
  }

  // 2. Personality Routes - `GET /personalities`
  try {
    const res = await fetch(`${BASE_URL}/personalities`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data)) {
      report('GET /personalities', true, `Found ${data.length} therapists: ${data.map(t => t.name).join(', ')}`);
    } else {
      report('GET /personalities', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /personalities', false, err.message);
  }

  // 3. Personality Routes - `GET /personalities/initial-message?id=dr-amara`
  try {
    const res = await fetch(`${BASE_URL}/personalities/initial-message?id=dr-amara`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200 && data.initialMessage) {
      report('GET /personalities/initial-message', true, `Greeting: "${data.initialMessage.substring(0, 40)}..."`);
    } else {
      report('GET /personalities/initial-message', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /personalities/initial-message', false, err.message);
  }

  // 4. Personality Routes - `GET /personalities/:id`
  try {
    const res = await fetch(`${BASE_URL}/personalities/dr-amara`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200 && data.name === 'Dr. Amara') {
      report('GET /personalities/:id', true, `Name: ${data.name}, Style: "${data.style}"`);
    } else {
      report('GET /personalities/:id', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /personalities/:id', false, err.message);
  }

  // 5. Session Management - `POST /sessions`
  try {
    const res = await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ therapistId: 'dr-amara' })
    });
    const data = await res.json();
    if (res.status === 201 && data.sessionId) {
      tempSessionId = data.sessionId;
      report('POST /sessions', true, `Created session ID: ${tempSessionId}`);
    } else {
      report('POST /sessions', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    report('POST /sessions', false, err.message);
  }

  // 6. Session Management - `GET /sessions`
  try {
    const res = await fetch(`${BASE_URL}/sessions`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.sessions)) {
      report('GET /sessions', true, `Found ${data.sessions.length} sessions`);
    } else {
      report('GET /sessions', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /sessions', false, err.message);
  }

  // 7. AI Chat Route - `POST /chat`
  try {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        sessionId: tempSessionId || 'test-session',
        therapistId: 'dr-amara',
        input: 'I have been feeling stressed and anxious today.'
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.message) {
      report('POST /chat', true, `Response: "${data.message.substring(0, 45)}...", Emotion: ${data.emotion}, Stress Index: ${data.stress_level}`);
    } else {
      report('POST /chat', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    report('POST /chat', false, err.message);
  }

  // 8. Session Management - `GET /sessions/:id/messages`
  if (tempSessionId) {
    try {
      const res = await fetch(`${BASE_URL}/sessions/${tempSessionId}/messages?limit=5`, { headers: AUTH_HEADER });
      const data = await res.json();
      if (res.status === 200) {
        report('GET /sessions/:id/messages', true, `Successfully fetched encrypted messages list`);
      } else {
        report('GET /sessions/:id/messages', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      report('GET /sessions/:id/messages', false, err.message);
    }
  } else {
    report('GET /sessions/:id/messages', false, 'Skipped (no session created)');
  }

  // 9. Mood & Analytics Routes - `GET /mood/timeline`
  try {
    const res = await fetch(`${BASE_URL}/mood/timeline?days=7`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /mood/timeline', true, `Timeline items found: ${Array.isArray(data) ? data.length : JSON.stringify(data)}`);
    } else {
      report('GET /mood/timeline', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /mood/timeline', false, err.message);
  }

  // 10. Mood & Analytics Routes - `GET /mood/heatmap`
  try {
    const res = await fetch(`${BASE_URL}/mood/heatmap?weeks=4`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /mood/heatmap', true, `Heatmap data loaded: ${Array.isArray(data) ? data.length : JSON.stringify(data)}`);
    } else {
      report('GET /mood/heatmap', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /mood/heatmap', false, err.message);
  }

  // 11. Mood & Analytics Routes - `GET /mood/summary`
  try {
    const res = await fetch(`${BASE_URL}/mood/summary`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /mood/summary', true, `Dominant: ${data.dominant_emotion || 'none'}`);
    } else {
      report('GET /mood/summary', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /mood/summary', false, err.message);
  }

  // 12. Daily Insights Routes - `GET /insights/latest`
  try {
    const res = await fetch(`${BASE_URL}/insights/latest`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200 || res.status === 404) {
      report('GET /insights/latest', true, res.status === 200 ? `Insight: "${data.insight?.substring(0, 40)}..."` : 'No insights found (404 expected if none generated)');
    } else {
      report('GET /insights/latest', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /insights/latest', false, err.message);
  }

  // 13. Admin Routes - `GET /admin/limits/:uid`
  try {
    const res = await fetch(`${BASE_URL}/admin/limits/dev-user-123`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /admin/limits/:uid', true, `Limits: ${JSON.stringify(data.limits)}`);
    } else {
      report('GET /admin/limits/:uid', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /admin/limits/:uid', false, err.message);
  }

  // 14. Admin Routes - `POST /admin/limits`
  try {
    const res = await fetch(`${BASE_URL}/admin/limits`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ uid: 'dev-user-123', messagesPerHour: 120, sessionsPerDay: 15 })
    });
    const data = await res.json();
    if (res.status === 200) {
      report('POST /admin/limits', true, `Message: ${data.message}`);
    } else {
      report('POST /admin/limits', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('POST /admin/limits', false, err.message);
  }

  // 15. Long-Term Memory - `GET /memory`
  try {
    const res = await fetch(`${BASE_URL}/memory`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /memory', true, `Memories list loaded successfully`);
    } else {
      report('GET /memory', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /memory', false, err.message);
  }

  // 16. Long-Term Memory - `DELETE /memory`
  try {
    const res = await fetch(`${BASE_URL}/memory`, {
      method: 'DELETE',
      headers: AUTH_HEADER
    });
    const data = await res.json();
    if (res.status === 200) {
      report('DELETE /memory', true, `Message: ${data.message}`);
    } else {
      report('DELETE /memory', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('DELETE /memory', false, err.message);
  }

  // 17. Thematic Profiling - `GET /themes`
  try {
    const res = await fetch(`${BASE_URL}/themes`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /themes', true, `Themes key counts: ${JSON.stringify(data)}`);
    } else {
      report('GET /themes', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /themes', false, err.message);
  }

  // 18. Zero-Knowledge Messages - `POST /messages`
  try {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        ciphertext: 'U2FsdGVkX1+vGV...',
        iv: '1234567890abcdef',
        sessionId: tempSessionId || 'test-session',
        role: 'user'
      })
    });
    const data = await res.json();
    if (res.status === 201 || res.status === 200) {
      report('POST /messages', true, `Message created with ID: ${data.messageId || 'success'}`);
    } else {
      report('POST /messages', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    report('POST /messages', false, err.message);
  }

  // 19. Zero-Knowledge Messages - `POST /messages/batch`
  try {
    const res = await fetch(`${BASE_URL}/messages/batch`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        messages: [
          {
            ciphertext: 'U2FsdGVkX1+vGV...',
            iv: '1234567890abcdef',
            sessionId: tempSessionId || 'test-session',
            role: 'user',
            client_id: 'cli-9'
          }
        ]
      })
    });
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.results)) {
      report('POST /messages/batch', true, `Synced batch response for ${data.results.length} items`);
    } else {
      report('POST /messages/batch', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    report('POST /messages/batch', false, err.message);
  }

  // 20. Device & Push Notification - `POST /auth/device`
  try {
    const res = await fetch(`${BASE_URL}/auth/device`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        token: 'fcm_token_test_123',
        deviceType: 'windows'
      })
    });
    const data = await res.json();
    if (res.status === 201) {
      report('POST /auth/device', true, `Status: ${data.message}`);
    } else {
      report('POST /auth/device', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    report('POST /auth/device', false, err.message);
  }

  // 21. Engagement Stats - `GET /stats`
  try {
    const res = await fetch(`${BASE_URL}/stats`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200) {
      report('GET /stats', true, `Streak: ${data.streak?.current} days, dominant mood: ${data.topEmotion}`);
    } else {
      report('GET /stats', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /stats', false, err.message);
  }

  // 22. GDPR & Data - `GET /account/export`
  try {
    const res = await fetch(`${BASE_URL}/account/export`, { headers: AUTH_HEADER });
    const data = await res.json();
    if (res.status === 200 && data.uid) {
      report('GET /account/export', true, `Export successful. Keys: ${Object.keys(data.data).join(', ')}`);
    } else {
      report('GET /account/export', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('GET /account/export', false, err.message);
  }

  // 23. Session Management - `POST /sessions/:id/close`
  if (tempSessionId) {
    try {
      const res = await fetch(`${BASE_URL}/sessions/${tempSessionId}/close`, {
        method: 'POST',
        headers: AUTH_HEADER
      });
      const data = await res.json();
      if (res.status === 200) {
        report('POST /sessions/:id/close', true, `Successfully closed and summarized session`);
      } else {
        report('POST /sessions/:id/close', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      report('POST /sessions/:id/close', false, err.message);
    }
  } else {
    report('POST /sessions/:id/close', false, 'Skipped (no session created)');
  }

  // 24. Session Management - `DELETE /sessions/:id`
  if (tempSessionId) {
    try {
      const res = await fetch(`${BASE_URL}/sessions/${tempSessionId}`, {
        method: 'DELETE',
        headers: AUTH_HEADER
      });
      const data = await res.json();
      if (res.status === 200) {
        report('DELETE /sessions/:id', true, `Successfully deleted session`);
      } else {
        report('DELETE /sessions/:id', false, `Status ${res.status}, body: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      report('DELETE /sessions/:id', false, err.message);
    }
  } else {
    report('DELETE /sessions/:id', false, 'Skipped (no session created)');
  }

  // 25. GDPR & Data - `DELETE /account`
  try {
    const res = await fetch(`${BASE_URL}/account`, {
      method: 'DELETE',
      headers: AUTH_HEADER
    });
    const data = await res.json();
    if (res.status === 200) {
      report('DELETE /account', true, `Erasure complete: ${data.message}. Documents Deleted: ${data.documentsDeleted}`);
    } else {
      report('DELETE /account', false, `Status ${res.status}`);
    }
  } catch (err) {
    report('DELETE /account', false, err.message);
  }

  console.log('\n=======================================');
  console.log(`Test Execution Finished!`);
  console.log(`Passed: ${passCount} | Failed: ${failCount}`);
  console.log('=======================================');
  
  process.exit(failCount === 0 ? 0 : 1);
}

runTests();
