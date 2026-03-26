# Project File Roles

This list explains exactly what each file in the **MindDialogue** project does.

### Core Entry Points
*   **example.js**: A demo script that runs a 3-turn conversation to show how the system works.
*   **src/index.js**: The main "switchboard" that exports all modules for use in other projects.

### Orchestration (The "Brains")
*   **src/executionPipelinePhase3.js**: The main controller that runs Phase 1, 2, and 3 logic in order.
*   **src/pipeline.js**: The Phase 1 controller (Sanitization -> Safety -> Intent -> Prompt).
*   **src/executionPipeline.js**: An older orchestrator for Phase 2 logic.

### Input Processing
*   **src/inputSanitizer.js**: Cleans user text (trims whitespace, basic cleanup).
*   **src/safetyChecker.js**: Scans for "crisis" words in user input to skip the LLM and provide a safe response.
*   **src/intentDetector.js**: Uses a keyword list to figure out if the user is "anxious", "sad", etc.

### Memory & History
*   **src/memoryManager.js**: Stores recent messages in a list (short-term session history).
*   **src/vectorMemoryManager.js**: Stores old messages in a database so they can be searched later.
*   **src/memoryFilter.js**: Decides if a specific message is important enough to save long-term.
*   **src/memoryCompressor.js**: Shrinks long messages into short summaries before saving them.

### Context & Personalization
*   **src/personaManager.js**: Loads a "therapist" character (like Dr. Amara) with specific personality traits.
*   **src/userProfileManager.js**: Tracks how often a user feels a certain way (User Profiling).
*   **src/adaptiveResponseController.js**: Changes how the LLM talks based on the User Profile.
*   **src/contextBuilder.js**: Gathers context (memories + profile) and formats it for the LLM.

### Prompt Assembly
*   **src/systemPromptBuilder.js**: Creates the core "You are an AI..." instruction based on the user's intent.
*   **src/promptAssembler.js**: Combines persona and history into a simple prompt (Phase 2).
*   **src/enhancedPromptAssembler.js**: Combines everything (persona, history, memories, profile) into a complex prompt (Phase 3).

### LLM Communication & Output
*   **src/llmClient.js**: Sends the final prompt to the local Ollama server and gets the response.
*   **src/responseSafetyCheck.js**: Scans the AI's reply to make sure it didn't say anything inappropriate.
*   **src/responsePostProcessor.js**: Cleans up the AI's reply and applies safe fallbacks if needed.

---

### 💡 Key Concept: `sessionId`
The project uses a **`sessionId`** to track who is talking. 
*   **As long as you use the same `sessionId`, the system will remember your chat history and your personal facts.**
*   Memory is currently **in-memory** (stored in RAM). If you restart your backend server, the memory will be cleared.
*   To make it permanent, you would eventually need to connect `memoryManager.js` and `vectorMemoryManager.js` to a real database like Redis or MongoDB.
