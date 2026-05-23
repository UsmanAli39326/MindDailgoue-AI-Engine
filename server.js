import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './src/routes/health.js';
import chatRoutes from './src/routes/chat.js';
import personalityRoutes from './src/routes/personalities.js';
import adminRoutes from './src/routes/admin.js';
import moodRoutes from './src/routes/mood.js';
import insightsRoutes from './src/routes/insights.js';
import sessionsRoutes from './src/routes/sessions.js';
import memoryRoutes from './src/routes/memory.js';
import themesRoutes from './src/routes/themes.js';
import messagesRoutes from './src/routes/messages.js';
import accountRoutes from './src/routes/account.js';
import deviceRoutes from './src/routes/device.js';
import statsRoutes from './src/routes/stats.js';
import authRoutes from './src/routes/auth.js';
import { verifyToken } from './src/middleware/auth.js';
import { verifyAppCheck } from './src/middleware/appCheck.js';
import { rateLimit } from './src/middleware/rateLimiter.js';
import { requestLogger } from './src/middleware/requestLogger.js';

import fs from 'fs';

dotenv.config({ override: true });
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(requestLogger);
app.use(cors());
app.use(express.json({ limit: '16kb' }));

// 1. Health check — fully public
app.use('/', healthRoutes);

// 2. Public auth routes — NO App Check yet (register/login/refresh)
app.use('/auth', authRoutes);

// 3. App Check — applied to everything below
app.use(verifyAppCheck);

// 4. Token + rate limit
app.use(verifyToken);
app.use(rateLimit);

// 5. Protected routes
app.use('/chat', chatRoutes);
app.use('/personalities', personalityRoutes);
// ... rest of routes
app.use('/admin', adminRoutes);
app.use('/mood', moodRoutes);
app.use('/insights', insightsRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/memory', memoryRoutes);
app.use('/themes', themesRoutes);
app.use('/messages', messagesRoutes);
app.use('/account', accountRoutes);
app.use('/', deviceRoutes);
app.use('/stats', statsRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`✅ MindDialogue API Server (Express) listening on port ${PORT}`);
});