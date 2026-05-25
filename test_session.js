import fetch from 'node-fetch'; // We can use global fetch in Node >= 18

const BASE_URL = 'http://localhost:8000';
const AUTH_HEADER = {
  'Authorization': 'Bearer dev-user-123',
  'Content-Type': 'application/json'
};

async function testInitialMessage() {
  console.log("Creating new session...");
  const createRes = await fetch(`${BASE_URL}/sessions`, {
    method: 'POST',
    headers: AUTH_HEADER,
    body: JSON.stringify({ therapistId: 'dr-amara' })
  });
  
  if (!createRes.ok) {
    console.error("Failed to create session:", await createRes.text());
    process.exit(1);
  }
  
  const createData = await createRes.json();
  const sessionId = createData.sessionId;
  console.log(`Session created with ID: ${sessionId}`);
  console.log(`Bot Name: ${createData.botName}`);

  // Give Firebase a tiny bit of time to save the message if needed
  await new Promise(r => setTimeout(r, 500));

  console.log(`Fetching messages for session: ${sessionId}...`);
  const msgRes = await fetch(`${BASE_URL}/sessions/${sessionId}/messages`, {
    headers: AUTH_HEADER
  });

  if (!msgRes.ok) {
    console.error("Failed to fetch messages:", await msgRes.text());
    process.exit(1);
  }

  const msgData = await msgRes.json();
  const messages = msgData.messages || [];

  console.log(`Found ${messages.length} messages in the session.`);

  if (messages.length > 0) {
    const initialMsg = messages[0];
    console.log(`First message role: ${initialMsg.role}`);
    console.log(`First message ciphertext: ${initialMsg.ciphertext}`);
    if (initialMsg.role === 'assistant' && initialMsg.ciphertext) {
      console.log("✅ TEST PASSED: Initial bot message is successfully stored in the session!");
    } else {
      console.error("❌ TEST FAILED: Initial message is not an assistant message or lacks text.");
      process.exit(1);
    }
  } else {
    console.error("❌ TEST FAILED: No messages found in the newly created session.");
    process.exit(1);
  }
}

testInitialMessage().catch(err => {
  console.error("Test execution error:", err);
});
