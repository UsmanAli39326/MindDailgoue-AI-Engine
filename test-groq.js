import { callLLM } from './src/llmClient.js';

async function test() {
    try {
        console.log("Testing Groq API...");
        const response = await callLLM({
            prompt: "Say hello and confirm you are working."
        });
        console.log("Success! Response:");
        console.log(response);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
