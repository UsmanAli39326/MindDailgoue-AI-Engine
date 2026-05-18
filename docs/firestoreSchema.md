# Firestore Collection Schema

This document defines the structure of the Firestore collections for the MindDialogue backend.

## Collections

### `users/{uid}`
- **Purpose**: Root document for user data.
- **Fields**: 
    - `createdAt`: Timestamp
    - `lastActive`: Timestamp

#### Subcollection: `sessions/{sessionId}`
- **Purpose**: Stores individual chat sessions.
- **Fields**:
    - `therapistId`: String
    - `createdAt`: Timestamp
    - `updatedAt`: Timestamp
    - `status`: String (active|closed)

#### Subcollection: `messages/{msgId}`
- **Purpose**: Individual messages within a session (Encrypted).
- **Fields**:
    - `sender`: String (user|ai)
    - `ciphertext`: String
    - `iv`: String
    - `timestamp`: Timestamp

#### Subcollection: `moodLog/{YYYY-MM-DD}`
- **Purpose**: Daily aggregated mood entries for analytics.
- **Fields**:
    - `entries`: Array of objects:
        - `ts`: Timestamp
        - `emotion`: String
        - `intensity`: Number (0-1)
        - `stress`: Number (0-1)
        - `sessionId`: String

#### Subcollection: `memory/{memoryId}`
- **Purpose**: Long-term memory blobs (summaries).
- **Fields**:
    - `summary`: String
    - `themes`: Array of Strings
    - `createdAt`: Timestamp
    - `sessionId`: String

### `personalities/{id}`
- **Purpose**: Global and custom AI personalities.
- **Fields**:
    - `name`: String
    - `role`: String
    - `behavior`: String
    - `tone`: String
    - `boundaries`: String
    - `initialMessage`: String
    - `system_prompt`: String (compiled)
    - `isBuiltIn`: Boolean
    - `createdBy`: String (uid or 'system')

### `crisisLog/{uid}/{eventId}`
- **Purpose**: Audit trail for crisis detection (Metadata only).
- **Fields**:
    - `triggeredAt`: Timestamp
    - `sessionId`: String
    - `detectedBy`: String (ai|keyword)
    - `resolved`: Boolean

## Required Composite Indexes

To support database-level pagination, sorting, and limiting, the following composite indexes must be defined in the Firebase Console or `firestore.indexes.json`:

### 1. `users/{uid}/messages` Subcollection Index
* **Fields**:
    * `sessionId` (ASCENDING)
    * `timestamp` (ASCENDING)
* **Query Type**: Subcollection
* **Required For**: `GET /sessions/:id/messages` endpoint (performs high-performance database-level sorting, pagination, and cursor slicing on user message records).
