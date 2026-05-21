# 🧠 MindDialogue AI Engine

**MindDialogue** is a professional-grade AI therapy preprocessing and initialization engine. It transforms raw AI interactions into safe, personalized, and context-aware therapeutic experiences.

Designed to be the "Brain" behind mental health applications, MindDialogue focuses on **safety-first** AI orchestration, long-term memory management, and emotional intelligence.

---

## ✨ Key Features

### 🛡️ Safety-First Design
- **Automatic Crisis Detection**: Scans user input for high-risk keywords (e.g., self-harm) and bypasses the AI to provide immediate, pre-written emergency resources.
- **Response Post-Processing**: Every AI reply is checked for clinical appropriateness before being sent to the user.

### 🧠 Advanced Memory Management
- **Short-Term Session Flow**: Keeps track of the current conversation context.
- **Long-Term Vector Memory**: Remembers specific facts, events, and feelings mentioned in past sessions across days or weeks.
- **Memory Compression**: Summarizes old messages to keep the AI focused on what matters most.

### 🎭 Clinical Personas
- Choose from multiple therapist personalities (e.g., Dr. Amara for warmth, Dr. Marcus for growth-oriented coaching).
- Each persona has a unique therapeutic style, tone, and clinical approach.

### 📊 User Profiling & Adaptive Responses
- Tracks emotional trends over time (Anxiety, Sadness, Hopefulness).
- Adapts the AI's tone based on the user's historical profile and current mood.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- An [OpenRouter](https://openrouter.ai/) API Key

### 2. Installation
```bash
npm install
```

### 3. Configuration
Create a `.env` file in the root directory (never commit this!):
```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
```

You must also obtain a `google-services.json` file from the Firebase console (Project Settings > Service accounts) and place it in the root directory. **Never commit this file.** See `google-services.json.example` for the required format.

### 4. Run Locally
```bash
npm start
```
The server will be available at `http://localhost:8000`.

---

## 🐳 Docker Support

Build and run the engine using Docker:
```bash
docker build -t mind-dialogue .
docker run -p 8000:8000 -e OPENROUTER_API_KEY=your_key mind-dialogue
```

---

## 📂 Project Structure
- `src/`: Core logic (Sanitizers, Safety, Memory, Personas).
- `server.js`: The HTTP API entry point.
- `tests/`: Comprehensive Jest testing suite (264 tests across 31 suites).

---

## 📄 License
MIT License. Created by [Usman Ali](https://github.com/UsmanAli39326).
