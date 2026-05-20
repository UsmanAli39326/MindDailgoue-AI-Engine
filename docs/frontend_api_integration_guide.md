# MindDialogue API: Mobile Integration & Long-Term Maintenance Guide

This document is the definitive guide to integrating the MindDialogue backend with a mobile application (such as Flutter). It covers architectural best practices for long-term maintainability and provides exhaustive specifications for every API endpoint.

---

## Part 1: Mobile Architecture Best Practices

To ensure your application remains maintainable, testable, and scalable over a long period, we strongly recommend adopting **Clean Architecture** with the **Repository Pattern**.

### 1. The Repository Pattern
Never call HTTP endpoints directly from your UI components (like Widgets in Flutter). Instead, create abstract repositories.
- **Data Sources**: Create a `MindDialogueApiDataSource` class that handles the raw `http` or `dio` calls, JSON serialization/deserialization, and status code checking.
- **Repositories**: Create classes like `ChatRepository` or `AuthRepository` that depend on the data source. They should return strongly-typed models (e.g., `MessageModel`) and handle localized error parsing.

### 2. Centralized Interceptors (Dio / HTTP)
Do not manually attach the `Authorization` header to every request. 
- Create an **Auth Interceptor** that intercepts every outgoing request, reads the `idToken` from secure storage (e.g., `flutter_secure_storage`), and injects `Authorization: Bearer <token>`.
- Create a **Refresh Interceptor** that listens for `401 Unauthorized` responses and silently calls `POST /auth/refresh` with the stored `refreshToken` to get a new `idToken`, then retries the failed request. No Firebase SDK is needed on the client.

### 3. Unified Error & Rate Limit Handling
- Create an **Error Interceptor** that globally catches `429 Too Many Requests`. When caught, it should broadcast an event (e.g., via a Stream or BLoC) that triggers a global "Cooldown Timer" overlay in your UI, using the `retryAfter` field from the error payload.

### 4. Optimistic UI & Offline Queueing
- **Local Database**: Use `sqflite` or `Isar` to store all messages locally.
- **Optimistic Updates**: When a user sends a message, immediately save it locally and render it on screen. Then make the API call. 
- **Background Sync**: If the API call fails due to no internet, flag the message as `pending` locally. Use a background worker to push pending messages to `/messages/batch` when the device reconnects.

---

## Part 2: Exhaustive API Specification

### 1. Authentication Endpoints (`/auth`)

#### 1.1 Register User
- **Method & Endpoint**: `POST /auth/register`
- **Auth Required**: No
- **Purpose**: Creates a Firebase account and initializes the user profile.
- **Required Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123",
    "name": "Jane Doe",
    "background": "Software engineer, loves reading"
  }
  ```
  *(Note: `name` and `background` are technically optional but critical for personalized AI responses. Do not send phone numbers or addresses).*
- **Expected Response (201 Created)**:
  ```json
  {
    "uid": "firebase_uid",
    "idToken": "jwt_token_string",
    "refreshToken": "refresh_token_string",
    "email": "user@example.com"
  }
  ```

#### 1.2 Login User
- **Method & Endpoint**: `POST /auth/login`
- **Auth Required**: No
- **Purpose**: Authenticates an existing user.
- **Required Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123"
  }
  ```
- **Expected Response (200 OK)**:
  ```json
  {
    "uid": "firebase_uid",
    "idToken": "jwt_token_string",
    "refreshToken": "refresh_token_string",
    "email": "user@example.com"
  }
  ```

#### 1.3 Logout User
- **Method & Endpoint**: `POST /auth/logout`
- **Auth Required**: Yes (`Authorization: Bearer <idToken>`)
- **Purpose**: Logs the user out on the backend, specifically wiping their FCM token so they stop receiving push notifications on this device.
- **Required Payload**:
  ```json
  {
    "fcmToken": "device_fcm_token_string"
  }
  ```
  *(Note: Send the same FCM token you registered the device with. This is optional).*
- **Expected Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

#### 1.4 Refresh Token
- **Method & Endpoint**: `POST /auth/refresh`
- **Auth Required**: No (uses `refreshToken` instead)
- **Purpose**: Exchanges an expired `idToken`'s companion `refreshToken` for a fresh `idToken`. Firebase ID tokens expire after **1 hour**. Your frontend should call this automatically when it receives a `401` response, or proactively before expiry.
- **Required Payload**:
  ```json
  {
    "refreshToken": "refresh_token_string_from_login"
  }
  ```
- **Expected Response (200 OK)**:
  ```json
  {
    "idToken": "new_jwt_token_string",
    "refreshToken": "new_refresh_token_string",
    "expiresIn": "3600"
  }
  ```
  *(Note: `expiresIn` is in seconds. Store the new `refreshToken` — Firebase may rotate it on each refresh. The `idToken` should replace the old one in secure storage.)*
- **Error Response (400)**:
  ```json
  {
    "error": "TOKEN_EXPIRED"
  }
  ```
  *(If the refresh token itself is revoked/invalid, redirect the user to the login screen.)*

---

### 2. Device & Push Notifications

#### 2.1 Register Device Token
- **Method & Endpoint**: `POST /auth/device`
- **Auth Required**: Yes
- **Purpose**: Stores the device FCM token to enable proactive check-ins ("we miss you" notifications).
- **Required Payload**:
  ```json
  {
    "token": "device_fcm_token_string",
    "deviceType": "android" 
  }
  ```
  *(Note: `deviceType` can be 'ios', 'android', or 'web').*
- **Expected Response (201 Created)**:
  ```json
  {
    "message": "Device registered successfully",
    "token": "device_fcm_token_string"
  }
  ```

---

### 3. Core Chat Execution (`/chat`)

#### 3.1 Send Message
- **Method & Endpoint**: `POST /chat`
- **Auth Required**: Yes
- **Purpose**: The primary endpoint. Submits user input, executes the AI safety/memory pipeline, and returns the AI response.
- **Required Payload**:
  ```json
  {
    "sessionId": "current_session_id",
    "therapistId": "dr_sage",
    "input": "I'm feeling really stressed about my exams today."
  }
  ```
- **Expected Response (200 OK)**:
  ```json
  {
    "message": "Exams can be incredibly overwhelming. Let's break down what's stressing you out most...",
    "emotion": "stressed",
    "intensity": 0.8,
    "stress_level": 0.7,
    "crisis": false,
    "suggestions": ["Break it down", "Take a breathing break"],
    "mood_tag": "anxious",
    "therapistId": "dr_sage",
    "detectedIntent": "academic_stress",
    "isHighRisk": false
  }
  ```
- **Error Response (429 Too Many Requests)**:
  ```json
  {
    "error": "Rate limit exceeded. Please wait.",
    "retryAfter": 120 
  }
  ```

---

### 4. Session Management (`/sessions`)

#### 4.1 Create Session
- **Method & Endpoint**: `POST /sessions`
- **Auth Required**: Yes
- **Purpose**: Starts a new logical conversation thread.
- **Required Payload**:
  ```json
  {
    "therapistId": "dr_sage"
  }
  ```
- **Expected Response (201 Created)**:
  ```json
  {
    "sessionId": "unique_session_id_string",
    "therapistId": "dr_sage",
    "createdAt": "2023-10-27T10:00:00.000Z",
    "status": "active",
    "messageCount": 0
  }
  ```

#### 4.2 List Sessions
- **Method & Endpoint**: `GET /sessions`
- **Auth Required**: Yes
- **Purpose**: Returns the user's recent chat history list.
- **Required Payload**: None
- **Expected Response (200 OK)**:
  ```json
  {
    "sessions": [
      {
        "id": "unique_session_id_string",
        "therapistId": "dr_sage",
        "status": "closed",
        "createdAt": "2023-10-27T10:00:00.000Z",
        "closedAt": "2023-10-27T11:00:00.000Z"
      }
    ]
  }
  ```

#### 4.3 Get Session Messages
- **Method & Endpoint**: `GET /sessions/:id/messages?limit=50&cursor=last_doc_id`
- **Auth Required**: Yes
- **Purpose**: Retrieves paginated, encrypted message history for a specific session.
- **Required Payload**: None (use query parameters `limit` and `cursor`).
- **Expected Response (200 OK)**:
  ```json
  {
    "messages": [
      {
        "id": "message_id_string",
        "ciphertext": "encrypted_base64_string",
        "iv": "initialization_vector_string",
        "role": "user",
        "timestamp": "2023-10-27T10:05:00.000Z"
      }
    ],
    "nextCursor": "message_id_string_for_next_page"
  }
  ```

#### 4.4 Close Session
- **Method & Endpoint**: `POST /sessions/:id/close`
- **Auth Required**: Yes
- **Purpose**: Closes a session, triggering the AI to summarize it in the background.
- **Required Payload**: None
- **Expected Response (200 OK)**:
  ```json
  {
    "message": "Session closed successfully",
    "sessionId": "unique_session_id_string",
    "summary": {
      "text": "User discussed exam stress.",
      "themes": ["academics", "anxiety"]
    }
  }
  ```

#### 4.5 Delete Session
- **Method & Endpoint**: `DELETE /sessions/:id`
- **Auth Required**: Yes
- **Required Payload**: None
- **Expected Response (200 OK)**: `{ "message": "Session deleted successfully" }`

---

### 5. Manual Message Sync (`/messages`)
*Note: Do not use this for real-time chat. Only use this to sync messages created while the device was offline.*

#### 5.1 Batch Sync Messages
- **Method & Endpoint**: `POST /messages/batch`
- **Auth Required**: Yes
- **Required Payload**:
  ```json
  {
    "messages": [
      {
        "ciphertext": "encrypted_text",
        "iv": "iv_string",
        "sessionId": "session_id",
        "role": "user",
        "client_id": "local_sqlite_id" 
      }
    ]
  }
  ```
- **Expected Response (200 OK)**: `{ "synced": 1, "failed": 0, "results": [...] }`

---

### 6. Personalities (`/personalities`)

#### 6.1 List Personalities
- **Method & Endpoint**: `GET /personalities`
- **Auth Required**: Yes
- **Required Payload**: None
- **Expected Response (200 OK)**: Array of persona objects.
  ```json
  [
    {
      "id": "custom-1716035987",
      "name": "ZenMaster",
      "style": "Coach",
      "tone": "Balanced",
      "depth": "Medium",
      "traits": ["Calm", "Friendly"],
      "backstory": "A mindful guru promoting meditation.",
      "avatarAsset": "assets/avatars/zen.png"
    }
  ]
  ```

#### 6.2 Get Personality by ID
- **Method & Endpoint**: `GET /personalities/:id`
- **Auth Required**: Yes
- **Required Payload**: None
- **Expected Response (200 OK)**:
  ```json
  {
    "id": "custom-1716035987",
    "name": "ZenMaster",
    "greeting": "Hi there! I'm ZenMaster. Let's work together to set goals, build momentum, and grow. *What shall we focus on today?*",
    "style": "Coach",
    "tone": "Balanced",
    "depth": "Medium",
    "traits": ["Calm", "Friendly"],
    "backstory": "A mindful guru promoting meditation.",
    "avatarAsset": "assets/avatars/zen.png"
  }
  ```

#### 6.3 Create Custom Persona
- **Method & Endpoint**: `POST /personalities`
- **Auth Required**: Yes

##### Option A: Structured Option-Based Creation (Recommended for Mobile UI)
Use this option to construct a premium therapist companion automatically using simple, high-level choices:
- **Required Payload**:
  ```json
  {
    "name": "ZenMaster",
    "avatarAsset": "assets/avatars/zen.png",
    "traits": ["Calm", "Friendly"],
    "tone": "Balanced",
    "depth": "Medium",
    "style": "Coach",
    "backstory": "A mindful guru promoting meditation."
  }
  ```
  *Values Spec:*
  * `traits`: Any selection from `["Calm", "Logical", "Friendly", "Strict", "Motivational", "Empathetic"]`
  * `tone`: `"Emotional"`, `"Balanced"`, `"Rational"`
  * `depth`: `"Short"`, `"Medium"`, `"Deep"`
  * `style`: `"Advice"`, `"Listener"`, `"Coach"`
  * `backstory`: Free-form therapist background and approach string.

##### Option B: Raw Prompt Creation (Legacy & Advanced)
Directly supply pre-compiled clinical prompts and messages:
- **Required Payload**:
  ```json
  {
    "name": "My Buddy",
    "style": "Casual",
    "tone": "Friendly",
    "personalityPrompt": "You are a supportive friend...",
    "initialMessage": "Hey there! How's it going?",
    "avatarAsset": "assets/avatars/friendly.png"
  }
  ```
- **Expected Response (201 Created)**: Returns the completed persona object including its new `id`, compiled `personalityPrompt`, `initialMessage`, and metadata.

---

### 7. Analytics & Dashboard

#### 7.1 Unified Stats
- **Method & Endpoint**: `GET /stats`
- **Auth Required**: Yes
- **Purpose**: Returns everything needed to render the user's Profile dashboard.
- **Required Payload**: None
- **Expected Response (200 OK)**:
  ```json
  {
    "streak": { "current": 3, "longest": 10, "totalDays": 15 },
    "sessions": { "total": 20, "thisWeek": 4 },
    "topEmotion": "stressed",
    "insight": { "text": "You've been tackling a lot of academic stress lately.", "generatedAt": "2023-10-27T00:00:00Z" },
    "badges": ["first-session", "3-day-streak"]
  }
  ```

#### 7.2 Mood Heatmap
- **Method & Endpoint**: `GET /mood/heatmap?weeks=12`
- **Auth Required**: Yes
- **Required Payload**: None
- **Expected Response (200 OK)**: Returns an array of dates and stress scores.

---

### 8. GDPR & Privacy

#### 8.1 Clear Memory
- **Method & Endpoint**: `DELETE /memory`
- **Auth Required**: Yes
- **Purpose**: Erases the AI's semantic knowledge of the user without deleting their account.
- **Expected Response (200 OK)**: `{ "message": "Memory cleared successfully" }`

#### 8.2 Delete Account
- **Method & Endpoint**: `DELETE /account`
- **Auth Required**: Yes
- **Purpose**: Hard deletes the user and all their Firestore data.
- **Expected Response (200 OK)**: `{ "message": "Account data deleted successfully" }`

---

## Part 3: Critical Use Cases & Frontend State Handling

To build a robust companion app, the frontend must correctly interpret the data returned by the `POST /chat` endpoint. The backend has several autonomous systems (like the Crisis Scanner and Rate Limiter) that dictate how the UI should react.

### Use Case 1: Crisis Detection (High Risk)
When a user types something concerning (e.g., "I want to hurt myself"), the backend's Crisis Scanner intercepts the message.
- **Backend Behavior**: The LLM is bypassed or forced into a restricted "crisis mode". The backend attaches emergency hotlines to the response.
- **What the API Returns**:
  ```json
  {
    "message": "I am deeply concerned about your safety...",
    "crisis": true,
    "isHighRisk": true,
    "resources": [
      {
        "name": "SPECIALIST ON CALL",
        "phone": "+1-800-555-0144"
      },
      {
        "name": "National Suicide Prevention Lifeline",
        "phone": "988"
      }
    ]
  }
  ```
- **Frontend Action**: 
  1. Detect `crisis === true` or `isHighRisk === true`.
  2. Visually alter the UI (e.g., change the background to a calm, alert color).
  3. Render the `resources` array as prominent, clickable buttons (using `url_launcher` in Flutter to trigger a phone call).

### Use Case 2: Post-Crisis Cooldown
After a crisis is triggered, the backend puts the user in a mandatory "Cooldown" period to prevent them from endlessly looping the AI instead of seeking real help.
- **Backend Behavior**: Blocks any new messages on `POST /chat` for 15 minutes.
- **What the API Returns (403 Forbidden)**:
  ```json
  {
    "error": "You are in a cooldown period to ensure your safety.",
    "cooldownRemainingMs": 850000 
  }
  ```
- **Frontend Action**:
  1. Catch the `403` error.
  2. Disable the chat input text field.
  3. Display a countdown timer parsing `cooldownRemainingMs`, alongside the emergency resources.

### Use Case 3: Rate Limiting & Abuse Prevention
To prevent abuse and manage LLM costs, the backend enforces limits (e.g., max 50 messages per hour).
- **Backend Behavior**: Rejects messages that exceed the threshold.
- **What the API Returns (429 Too Many Requests)**:
  ```json
  {
    "error": "Rate limit exceeded",
    "retryAfter": 3600
  }
  ```
- **Frontend Action**:
  1. Catch the `429` error.
  2. Disable the send button.
  3. Show a friendly message: "I'm feeling a bit tired right now. Let's chat again in [time]."

### Use Case 4: Token Expiration (Auth Refresh)
Firebase `idTokens` expire after 1 hour. Since the frontend does **not** use the Firebase SDK, token refresh is handled entirely through the backend.
- **Backend Behavior**: If the app sends an expired token in the `Authorization` header, the backend rejects it.
- **What the API Returns (401 Unauthorized)**:
  ```json
  {
    "error": "Unauthorized: Invalid or expired token"
  }
  ```
- **Frontend Action**:
  1. An HTTP Interceptor catches the `401`.
  2. The Interceptor calls `POST /auth/refresh` with the stored `refreshToken`.
  3. On success: store the new `idToken` and `refreshToken` in secure storage, then automatically retry the failed API call with the new token — the user never notices.
  4. On failure (e.g., refresh token revoked): clear stored tokens and redirect the user to the login screen.

### Use Case 5: Offline Mode & Reconnection
Mobile users frequently lose service (e.g., entering a tunnel).
- **Backend Behavior**: N/A (Server is unreachable).
- **Frontend Action**:
  1. The API call (`dio.post('/chat')`) throws a `SocketException` or Timeout.
  2. The app saves the user's message in the local SQLite database with `status = "pending"`.
  3. The message is displayed in the chat UI with a "clock" icon indicating it hasn't been sent.
  4. When the OS reports network connectivity restored, a background task uploads the pending message to `POST /messages/batch`.