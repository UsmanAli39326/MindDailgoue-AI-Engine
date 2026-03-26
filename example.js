// ─────────────────────────────────────────────────────────────
// example.js
// Demonstration of how to use the Phase 3 AI Therapist Pipeline with OpenRouter.
//
// Prerequisites:
// 1. You must have an OpenRouter API key.
// 2. Add `OPENROUTER_API_KEY=your_key` to `.env.local`.
//
// Run with: node example.js
// ─────────────────────────────────────────────────────────────

import { executionPipelinePhase3 } from './src/index.js';

async function runDemo() {
  const sessionId = 'demo-session-' + Date.now(); // Unique session
  const therapistId = 'compassionate-listener'; // Dr. Amara

  console.log('─────────────────────────────────────────────────────────');
  console.log('🧠 Starting MindDialogue AI Therapist Demo (Phase 3)');
  console.log('─────────────────────────────────────────────────────────\n');

  // Turn 1: Establish baseline emotion
  console.log('👤 User: "I had a really rough day today. My boss yelled at me and I feel overwhelmed."');

  let result = await executionPipelinePhase3.executePhase3({
    sessionId,
    therapistId,
    input: 'I had a really rough day today. My boss yelled at me and I feel overwhelmed.'
  });

  console.log(`\n🤖 Therapist (Intent: ${result.detectedIntent}):`);
  console.log(result.response);
  console.log(`[Metadata: Memories injected: ${result.relevantMemoriesUsed}, Profile Update: ${result.profileUpdated}]\n`);
  console.log('─────────────────────────────────────────────────────────\n');

  // Turn 2: Neutral statement. The system should remember the boss theme.
  console.log('👤 User: "I am trying to relax now but it is hard."');

  result = await executionPipelinePhase3.executePhase3({
    sessionId,
    therapistId,
    input: 'I am trying to relax now but it is hard.'
  });

  console.log(`\n🤖 Therapist (Intent: ${result.detectedIntent}):`);
  console.log(result.response);
  console.log(`[Metadata: Memories injected: ${result.relevantMemoriesUsed}, Profile Update: ${result.profileUpdated}]\n`);
  console.log('─────────────────────────────────────────────────────────\n');

  // Turn 3: A test of long-term profile tracking and memory injection
  console.log('👤 User: "Do you remember why I am so stressed out?"');

  result = await executionPipelinePhase3.executePhase3({
    sessionId,
    therapistId,
    input: 'Do you remember why I am so stressed out?'
  });

  console.log(`\n🤖 Therapist (Intent: ${result.detectedIntent}):`);
  console.log(result.response);
  console.log(`[Metadata: Memories injected: ${result.relevantMemoriesUsed}, Profile Update: ${result.profileUpdated}]\n`);
  console.log('─────────────────────────────────────────────────────────');

  console.log('\n✅ Demo completed.');
}

runDemo().catch(err => {
  console.error('Demo failed:', err);
}); 