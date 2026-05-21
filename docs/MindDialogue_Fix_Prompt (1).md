# MindDialogue AI Engine — Bug Fix Agent Prompt

You are working on **MindDialogue**, a Node.js/Express mental health AI backend that uses Firebase Admin SDK, Firestore, and OpenRouter/Ollama for LLM inference. The repo is at `https://github.com/UsmanAli39326/MindDailgoue-AI-Engine`.

A security and reliability audit has identified **16 bugs** across two categories: general application bugs and Firestore-specific failures. Fix all of them in the order listed. Do not refactor unrelated code. Each fix is scoped and described precisely below.

---

## PART 1 — General Application Bugs

### FIX 1 — CRITICAL: Rotate and gitignore the leaked Firebase API key
**File:** `google-services.json`, `.gitignore`

`google-services.json` containing a live Firebase API key (`AIzaSyA2yEboJvYVApj13J4plsb2mRfKw1GIzRA`) is committed to the public repo. 

1. Add `google-services.json` to `.gitignore` (create the file if it doesn't exist).
2. Add a `google-services.json.example` with placeholder values so developers know the format, but no real credentials.
3. Add a note in the README that this file must be obtained from the Firebase console and never committed.

> **Manual step (cannot be automated):** Revoke and regenerate the key in the Firebase console. This prompt cannot do that — flag it prominently in a `SECURITY_ACTION_REQUIRED.md` file at the repo root.

---

### FIX 2 — CRITICAL: Restrict CORS to known origins
**File:** `server.js`

Replace the open `cors()` call with an explicit allowlist.

```js
// BEFORE
app.use(cors());

// AFTER
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
```

Add `ALLOWED_ORIGINS=http://localhost:3000` to `.env.example`. In production, set this to the actual frontend domain(s).

---

### FIX 3 — CRITICAL: Remove hardcoded encryption key fallback
**File:** `src/services/encryptionService.js`

The fallback `'dev-secret-key-32-bytes-minddia'` must not exist in production. Replace the silent fallback with a hard crash at startup.

```js
// BEFORE
const rawKey = process.env.DB_ENCRYPTION_KEY || 'dev-secret-key-32-bytes-minddia';

// AFTER
const rawKey = process.env.DB_ENCRYPTION_KEY;
if (!rawKey) {
  throw new Error(
    '[ENCRYPTION] DB_ENCRYPTION_KEY environment variable is not set. ' +
    'Set a random 32+ character secret in your environment. ' +
    'Do NOT use a placeholder or default value in production.'
  );
}
```

Add `DB_ENCRYPTION_KEY=` to `.env.example` with a comment explaining it must be a securely generated random string (e.g. `openssl rand -hex 32`).

---

### FIX 4 — CRITICAL: Fix TOCTOU race condition in rate limiter
**File:** `src/middleware/rateLimiter.js`

The current flow reads the count, checks it, then writes — allowing concurrent requests to all pass before any are recorded. Fix by recording the timestamp **before** checking the limit, so concurrent requests see each other's entries.

```js
// In the rateLimit() middleware, reorder the message rate logic:

// 1. Prune old timestamps first
pruneOldTimestamps(uid);

// 2. Record this request's timestamp IMMEDIATELY (before the check)
const now = Date.now();
const isMessageEndpoint = req.method === 'POST' &&
  (req.path.startsWith('/chat') || req.path.startsWith('/messages'));

if (isMessageEndpoint) {
  const timestamps = messageTimestamps.get(uid) || [];
  timestamps.push(now);
  messageTimestamps.set(uid, timestamps);
}

// 3. NOW check if over limit
const timestamps = messageTimestamps.get(uid) || [];
if (timestamps.length > limits.messagesPerHour) {
  // Remove the timestamp we just added — request is rejected
  timestamps.pop();
  const oldestInWindow = timestamps[0];
  const retryAfterSec = Math.ceil(((oldestInWindow + 60 * 60 * 1000) - now) / 1000);
  return res.status(429).json({ ... });
}
```

Also remove the duplicate `isMessageEndpoint` block that currently appears later in the function.

---

### FIX 5 — HIGH: Stop lowercasing input before sending to the LLM
**File:** `src/inputSanitizer.js`

The `sanitize()` function lowercases the entire input string, which is then used as `cleanedInput` throughout — including what gets stored in memory and sent to the LLM. Proper nouns, names, and emphasis ("I am NOT okay") are destroyed.

Fix: remove `text = text.toLowerCase()` from the `sanitize()` pipeline. Instead, lowercase only inside the functions that need it for pattern matching (intent detector, crisis scanner). Those modules should call `.toLowerCase()` internally on their input before matching, not rely on the sanitiser to have done it.

Verify that `src/intentDetector.js` and `src/middleware/crisisScanner.js` both lowercase their input internally before pattern matching. If they don't, add `.toLowerCase()` at the top of those functions only.

---

### FIX 6 — HIGH: Fix the session rate limiter path check for /messages
**File:** `server.js`

`deviceRoutes` is mounted at `/auth`, but it handles device-related endpoints. The problem: `app.use('/auth', deviceRoutes)` means device routes share the `/auth` prefix. Verify the actual routes inside `deviceRoutes` and if any of them should be under `/devices` or `/device`, move the mount point to match. The rate limiter's path check for `/messages` currently never fires because of routing confusion.

Additionally, remove the duplicate `personalityRoutes` registration:

```js
// BEFORE (server.js has this twice):
app.use('/personalities', personalityRoutes); // line 53
app.use('/therapist', personalityRoutes);
app.use('/personalities', personalityRoutes); // line 56 — REMOVE THIS LINE

// AFTER:
app.use('/personalities', personalityRoutes);
app.use('/therapist', personalityRoutes);
```

---

### FIX 7 — HIGH: Add request body size limit
**File:** `server.js`

```js
// BEFORE
app.use(express.json());

// AFTER
app.use(express.json({ limit: '16kb' }));
```

---

### FIX 8 — HIGH: Extend crisis cooldown to a meaningful duration
**File:** `src/middleware/crisisHandler.js`

```js
// BEFORE
const COOLDOWN_MS = 60 * 1000; // 60 seconds

// AFTER
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
```

---

### FIX 9 — MEDIUM: Fix userProfileManager keyed by uid, not sessionId
**File:** `src/executionPipelinePhase3.js`

The profile store uses `sessionId` as the key, so the user's adaptive profile is discarded after every session. Change all profile calls to use `uid`.

```js
// BEFORE
const userProfile = getProfile(sessionId);
// ...
updateProfile(sessionId, { intent: ..., entities: ... });

// AFTER
const userProfile = getProfile(uid);
// ...
updateProfile(uid, { intent: ..., entities: ... });
```

---

### FIX 10 — MEDIUM: Guard against undefined message in LLM fallback
**File:** `src/executionPipelinePhase3.js`

When the LLM fails on a non-crisis request, `llmOutput.text` is set to a plain string, not a JSON envelope. Downstream `postProcess()` fails to parse it and `augmentedResponse.message` ends up `undefined`, causing `appendMessage` to throw.

Wrap the fallback in a proper JSON envelope:

```js
// BEFORE
llmOutput = {
  text: 'I\'m here and I want to help...',
  model: 'none'
};

// AFTER
llmOutput = {
  text: JSON.stringify({
    message: 'I\'m here and I want to help, but I\'m having a moment of difficulty. Could you share that with me again?',
    emotion: 'calm',
    intensity: 0.5,
    stress_level: 0.3,
    crisis: false,
    suggestions: [],
    mood_tag: 'llm_error_fallback'
  }),
  model: 'none'
};
```

---

### FIX 11 — MEDIUM: Remove the arity-hack from memoryManager
**File:** `src/memoryManager.js`

`getOrCreateSession`, `appendMessage`, and `getRecentHistory` all contain argument-shuffling hacks (`if (therapistId === undefined) { ... }`) that silently substitute `uid = 'test-uid'` in production if called with wrong arity. These are dangerous.

Remove all the arity-hack blocks. Make `uid` a required first argument. Update all call sites in `executionPipeline.js` (the old Phase 2 pipeline) to pass `uid` explicitly. Add a `sessionId` parameter clearly to every signature.

---

### FIX 12 — LOW: Fix admin route to check Firebase custom claims
**File:** `src/middleware/auth.js`, `src/routes/admin.js`

`verifyToken` sets `req.user = { uid }` only. Admin routes check `req.user?.isAdmin` which is always `undefined`. Fix by decoding custom claims in `verifyToken`:

```js
// In verifyToken, after decoding:
const decodedToken = await auth.verifyIdToken(token);
req.user = {
  uid: decodedToken.uid,
  isAdmin: decodedToken.admin === true, // requires Firebase custom claim
};
```

Document in the README that admin users must have the `admin: true` custom claim set via the Firebase Admin SDK or the Firebase console.

---

### FIX 13 — LOW: Guard the global error handler against double-send
**File:** `server.js`

```js
// BEFORE
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// AFTER
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## PART 2 — Firestore Connection Bugs

### FIX 14 — CRITICAL: Fix crisisLogger to use the shared db instance
**File:** `src/services/crisisLogger.js`

The file imports `admin` as default and calls `admin.firestore()` directly — bypassing the null-checked `db` export and crashing if Firebase initialisation failed.

```js
// BEFORE
import admin from '../config/firebase.js';
// ...
const db = admin.firestore();

// AFTER
import { db } from '../config/firebase.js';
// Remove the local `const db = ...` line entirely.
// Add a guard at the top of logCrisisEvent:
export async function logCrisisEvent(uid, sessionId, detectedBy) {
  if (!uid || !sessionId) { ... }
  if (!db) {
    console.error('[CRISIS LOGGER] Firestore unavailable. Crisis event NOT logged for user:', uid);
    return;
  }
  // rest of function unchanged, using the imported db
}
```

---

### FIX 15 — CRITICAL: Persist vector memory to Firestore
**File:** `src/vectorMemoryManager.js`

The entire vector memory system is in-process RAM and is lost on every restart. Add Firestore persistence.

**Write path** — in `storeMemory()`, after pushing to `sessionMemories`, write to Firestore:

```js
import { db } from './config/firebase.js';

// After sessionMemories.push({...}):
if (db) {
  db.collection('vectorMemory').doc(sessionId)
    .set({ memories: sessionMemories.map(m => ({
      text: m.text,
      embedding: m.embedding,
      metadata: m.metadata,
      timestamp: m.timestamp,
    }))}, { merge: false })
    .catch(err => console.error('[VECTOR MEMORY] Firestore write failed:', err.message));
}
```

**Read path** — add a `loadMemoriesFromFirestore(sessionId)` function and call it at the top of both `storeMemory()` and `retrieveRelevantMemories()` when `!memoryStore.has(sessionId)`:

```js
async function loadMemoriesFromFirestore(sessionId) {
  if (!db || memoryStore.has(sessionId)) return;
  try {
    const doc = await db.collection('vectorMemory').doc(sessionId).get();
    if (doc.exists) {
      memoryStore.set(sessionId, doc.data().memories || []);
    } else {
      memoryStore.set(sessionId, []);
    }
  } catch (err) {
    console.warn('[VECTOR MEMORY] Failed to load from Firestore:', err.message);
    memoryStore.set(sessionId, []);
  }
}
```

Add `vectorMemory/{sessionId}` to `docs/firestoreSchema.md`.

---

### FIX 16 — CRITICAL: Fix auto-summariser always-fires bug
**File:** `src/executionPipelinePhase3.js`

`getRecentHistory()` returns at most 10 messages. Splitting into lines always gives ~20 lines. `shouldSummarize(20)` evaluates `20 % 10 === 0 = true` — fires every single message.

Fix by tracking the raw message count instead of the formatted line count:

```js
// BEFORE
const currentHistory = await getRecentHistory(uid, sessionId);
const historyLines = currentHistory ? currentHistory.split('\n').filter(Boolean) : [];
if (shouldSummarize(historyLines.length)) { ... }

// AFTER — get the actual session message count from Firestore/cache
import { getSessionMessageCount } from './memoryManager.js'; // add this export

const messageCount = await getSessionMessageCount(uid, sessionId);
if (shouldSummarize(messageCount)) {
  const currentHistory = await getRecentHistory(uid, sessionId);
  const historyLines = currentHistory ? currentHistory.split('\n').filter(Boolean) : [];
  summarizeAndStore(uid, sessionId, historyLines).then(...).catch(...);
}
```

Add `getSessionMessageCount(uid, sessionId)` to `src/memoryManager.js`:

```js
export async function getSessionMessageCount(uid, sessionId) {
  let session = ramCache.get(sessionId);
  if (!session && db) {
    const doc = await getSessionDocRef(uid, sessionId).get();
    if (doc.exists) session = doc.data();
  }
  return session?.messages?.length ?? 0;
}
```

---

### FIX 17 — HIGH: Add missing Firestore composite indexes
**File:** `firestore.indexes.json` (create at repo root)

Create this file with the required composite indexes:

```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sessionId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lastActiveAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "memory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy with: `firebase deploy --only firestore:indexes`

---

### FIX 18 — HIGH: Cap and prune the activityDates array in streakService
**File:** `src/services/streakService.js`

Replace the unbounded `activityDates` array with a capped rolling window. Keep only the last 365 entries.

```js
// After pushing todayStr:
if (!activityDates.includes(todayStr)) {
  activityDates.push(todayStr);
}
// Cap to last 365 days
if (activityDates.length > 365) {
  activityDates = activityDates.slice(-365);
}
totalDays = activityDates.length;
```

---

### FIX 19 — HIGH: Make storeBatchMessages use a real Firestore batch
**File:** `src/services/encryptedStorage.js`

Replace the sequential `for` loop with proper chunked Firestore batch writes:

```js
export async function storeBatchMessages(uid, messages) {
  if (!uid || !Array.isArray(messages) || !db) return [];

  const results = [];
  // Chunk into groups of 500 (Firestore batch limit)
  const CHUNK_SIZE = 400; // stay under limit
  const chunks = [];
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    for (const msg of chunk) {
      // Handle idempotency check and encryption same as storeEncryptedMessage
      // then batch.set() instead of .add()
      const ref = db.collection('users').doc(uid).collection('messages').doc();
      batch.set(ref, { /* encrypted doc fields */ });
      results.push({ client_id: msg.client_id, server_id: ref.id, success: true });
    }
    await batch.commit();
  }
  return results;
}
```

---

### FIX 20 — HIGH: Paginate pruneAllMemory to avoid unbounded scan
**File:** `functions/pruneMemory.js`

Replace `listDocuments()` with a paginated query using a cursor:

```js
export async function pruneAllMemory() {
  if (!db) return;

  const BATCH_SIZE = 100;
  let lastDoc = null;
  let totalPruned = 0;

  while (true) {
    let query = db.collection('users').limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const userDoc of snapshot.docs) {
      totalPruned += await pruneUserMemory(userDoc.id);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < BATCH_SIZE) break;
  }

  console.log(`[PRUNE] Complete. ${totalPruned} blobs pruned.`);
}
```

Also add a 500-doc chunk guard to `deleteSessionMessages` and `pruneUserMemory` batch operations:

```js
// Replace single batch.commit() with chunked commits:
const CHUNK = 400;
for (let i = 0; i < docsToDelete.length; i += CHUNK) {
  const batch = db.batch();
  docsToDelete.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
  await batch.commit();
}
```

---

### FIX 21 — MEDIUM: Fix cache divergence in memoryManager under multi-instance deploys
**File:** `src/memoryManager.js`

The in-process `ramCache` diverges between server instances. Fix `appendMessage` to always read from Firestore first before writing, bypassing the stale cache for writes:

```js
export async function appendMessage(uid, sessionId, role, text) {
  // ... validation ...

  // Always fetch fresh from Firestore for writes (bypass stale cache)
  let session;
  if (db) {
    const docRef = getSessionDocRef(uid, sessionId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error(`Session "${sessionId}" does not exist.`);
    session = doc.data();
    ramCache.set(sessionId, session); // update cache with fresh data
  } else {
    session = ramCache.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" does not exist.`);
  }

  session.messages.push({ role, text, timestamp: new Date().toISOString() });
  session.messages = enforceMessageCap(session.messages);

  if (db) {
    await getSessionDocRef(uid, sessionId).update({ messages: session.messages });
    ramCache.set(sessionId, session);
  }
}
```

---

### FIX 22 — MEDIUM: Use Firestore Timestamps consistently
**File:** `src/services/sessionSummarizer.js`, `src/memoryManager.js`, `src/services/moodService.js`, `src/services/streakService.js`

Replace all `new Date().toISOString()` used as `createdAt`/`timestamp` fields in Firestore writes with `admin.firestore.FieldValue.serverTimestamp()`.

```js
import { FieldValue } from 'firebase-admin/firestore';

// BEFORE
createdAt: new Date().toISOString()

// AFTER
createdAt: FieldValue.serverTimestamp()
```

For fields used in `orderBy` queries, also update the read paths to handle Firestore Timestamp objects (`.toDate().toISOString()`) rather than assuming strings.

---

### FIX 23 — MEDIUM: Replace 90-read mood log fan-out with a range query
**File:** `src/services/moodService.js`

Replace the `Promise.all(dates.map(...))` pattern with a single collection group query:

```js
export async function getMoodLogs(uid, days = 30) {
  if (!uid || !db) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"

  try {
    const snapshot = await db
      .collection('users').doc(uid)
      .collection('moodLog')
      .where(admin.firestore.FieldPath.documentId(), '>=', cutoffStr)
      .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      // decrypt entries as before
      return { date: doc.id, ...data };
    });
  } catch (error) {
    console.error('[MOOD SERVICE] Failed to fetch mood logs:', error.message);
    return [];
  }
}
```

---

### FIX 24 — LOW: Add Firestore security rules
**File:** `firestore.rules` (create at repo root)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own data
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Crisis log: write-only for the authenticated user, read only for admins
    match /crisisLog/{uid}/{document=**} {
      allow create: if request.auth != null && request.auth.uid == uid;
      allow read, update, delete: if request.auth.token.admin == true;
    }

    // Rate limits: backend only (no client access)
    match /rateLimits/{uid} {
      allow read, write: if false;
    }

    // Personalities: all authenticated users can read built-ins; owners can write their own
    match /personalities/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (resource.data.createdBy == request.auth.uid || request.auth.token.admin == true);
    }

    // Clinical doctors: read-only for authenticated users
    match /clinical_doctors/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy with: `firebase deploy --only firestore:rules`

---

## Verification Checklist

After applying all fixes, verify the following:

- [ ] `google-services.json` is in `.gitignore` and `SECURITY_ACTION_REQUIRED.md` exists
- [ ] `DB_ENCRYPTION_KEY` missing causes server startup to throw (not silently use a default)
- [ ] `CORS` rejects requests from unlisted origins
- [ ] `crisisLogger.js` imports `db` from `config/firebase.js`, not `admin.firestore()` directly
- [ ] Vector memories survive a server restart (check Firestore `vectorMemory` collection after a chat)
- [ ] Auto-summariser only fires when `getSessionMessageCount` returns a multiple of 10 (not every message)
- [ ] `firestore.indexes.json` exists and indexes are deployed (`firebase deploy --only firestore:indexes`)
- [ ] `firestore.rules` exists and is deployed (`firebase deploy --only firestore:rules`)
- [ ] `storeBatchMessages` uses chunked `db.batch()` writes, not sequential `await` calls
- [ ] `pruneAllMemory` paginates using cursor — does not call `listDocuments()` without a limit
- [ ] Batch deletes in `deleteSessionMessages` and `pruneUserMemory` are chunked at 400 ops max
- [ ] `activityDates` is capped at 365 entries
- [ ] Input sanitiser no longer calls `toLowerCase()` — intent/safety modules lowercase internally
- [ ] `personalityRoutes` mounted only once in `server.js`
- [ ] `express.json({ limit: '16kb' })` is set
- [ ] All existing tests pass: `npm test`
