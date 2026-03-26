import { filterMemory, _internals } from '../src/memoryFilter.js';

describe('memoryFilter', () => {
  test('rejects empty or non-string inputs', () => {
    expect(filterMemory('', 'neutral', false).shouldStore).toBe(false);
    expect(filterMemory(null, 'neutral', false).shouldStore).toBe(false);
    expect(filterMemory('   ', 'neutral', false).shouldStore).toBe(false);
  });

  test('stores high risk inputs', () => {
    const result = filterMemory('I am in danger', 'fear', true);
    expect(result.shouldStore).toBe(true);
    expect(result.importance).toBe('high');
  });

  test('stores strong emotion inputs', () => {
    const result = filterMemory('I feel very sad today', 'sad', false);
    expect(result.shouldStore).toBe(true);
    expect(result.importance).toBe('high');
  });

  test('stores personal facts with medium importance', () => {
    const result = filterMemory('My boss yelled at me today', 'neutral', false);
    expect(result.shouldStore).toBe(true);
    expect(result.importance).toBe('medium');
  });

  test('rejects casual small talk', () => {
    const result = filterMemory('hello there', 'neutral', false);
    expect(result.shouldStore).toBe(false);
    expect(result.importance).toBe('low');
  });

  test('rejects short false-positives', () => {
    // "my job" matches the pattern, but it's only 6 chars, so it should be filtered out
    const result = filterMemory('my job', 'neutral', false);
    expect(result.shouldStore).toBe(false);
    expect(result.importance).toBe('low');
  });

  test('does not downgrade high importance if personal fact is also present', () => {
    const result = filterMemory('My wife left me and I am sad', 'sad', false);
    expect(result.shouldStore).toBe(true);
    expect(result.importance).toBe('high'); // Sad makes it high
  });
});
