import http from 'http';
import { executePhase3 } from './src/executionPipelinePhase3.js';
import { getPersonaById } from './src/personaManager.js';
import url from 'url';

const PORT = process.env.PORT || 8000;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'MindDialogue AI API is running!',
      status: 'online'
    }));
    return;
  }

  // Get Therapist Initial Message
  if (req.method === 'GET' && req.url.startsWith('/therapist/initial-message')) {
    const queryObject = url.parse(req.url, true).query;
    const therapistId = queryObject.id;

    if (!therapistId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing therapist id parameter' }));
      return;
    }

    try {
      const persona = getPersonaById(therapistId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        therapistId: persona.id,
        name: persona.name,
        initialMessage: persona.initialMessage 
      }));
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Chat Endpoint
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { sessionId, therapistId, input } = JSON.parse(body);
        console.log(`[SERVER] Processing chat request: Session=${sessionId}, Therapist=${therapistId}, Input="${input}"`);
        
        if (!sessionId || !therapistId || !input) {
          console.warn('[SERVER] Missing required fields in request');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: sessionId, therapistId, input' }));
          return;
        }

        const result = await executePhase3({ sessionId, therapistId, input });
        console.log(`[SERVER] Pipeline complete, sending response.`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('[SERVER] API Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', details: error.message }));
      }
    });
    return;
  }

  // Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`MindDialogue API Server listening on port ${PORT}`);
});
