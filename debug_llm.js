import { callLLM } from './src/llmClient.js';

async function test() {
  try {
    console.log('Testing callLLM with "tinyllama"...');
    const result = await callLLM({ prompt: 'Hello', model: 'tinyllama' });
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Failed with "tinyllama":', err.message);
    
    try {
      console.log('Retrying with "tinyllama:latest"...');
      const result = await callLLM({ prompt: 'Hello', model: 'tinyllama:latest' });
      console.log('Success with "tinyllama:latest":', JSON.stringify(result, null, 2));
    } catch (err2) {
      console.error('Failed with "tinyllama:latest":', err2.message);
    }
  }
}

test();
