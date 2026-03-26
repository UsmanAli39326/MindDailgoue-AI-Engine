import { processInput } from './src/pipeline.js';
import { updateProfile, getProfile } from './src/userProfileManager.js';
import { buildProfileContext } from './src/contextBuilder.js';

const sessionId = 'test-session-123';
const inputs = [
    "Hi, I'm Alex. I've been feeling stressed at work.",
    "My mother is visiting, and it's making me anxious.",
    "I'm having trouble with sleep lately."
];

console.log("--- Starting Extraction Test ---");

for (const input of inputs) {
    console.log(`\nInput: "${input}"`);
    const phase1 = processInput(input);
    const entities = phase1.metadata.entities;
    console.log("Extracted Entities:", JSON.stringify(entities, null, 2));

    updateProfile(sessionId, { 
        intent: phase1.detectedIntent,
        entities: entities
    });

    const profile = getProfile(sessionId);
    // console.log("Updated Profile:", JSON.stringify(profile, null, 2));
    
    const context = buildProfileContext(profile);
    console.log("Context Builder Output:\n", context);
}

console.log("\n--- Extraction Test Complete ---");
