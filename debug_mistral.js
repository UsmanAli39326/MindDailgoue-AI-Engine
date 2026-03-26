import { callLLM } from './src/llmClient.js';

async function testMistral() {
  console.log('Testing Mistral connection...');
  try {
    const result = await callLLM({
      prompt: 'Hello, how are you?',
      model: 'mistral'
    });
    console.log('Success:', result);
  } catch (error) {
    console.error('Error in callLLM:', error.message);
  }
}

testMistral();
