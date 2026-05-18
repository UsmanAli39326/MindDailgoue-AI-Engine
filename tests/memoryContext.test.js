// ─────────────────────────────────────────────────────────────
// memoryContext.test.js
// Tests for memory context assembly and injection.
// ─────────────────────────────────────────────────────────────

import { buildCrossSessionContext, _internals } from '../src/services/memoryContext.js';
import { buildMemoryContext } from '../src/contextBuilder.js';

describe('memoryContext', () => {

  describe('buildCrossSessionContext', () => {
    test('returns formatted string for valid memory blobs', () => {
      const blobs = [
        { summary: 'User discussed anxiety.', createdAt: '2026-05-15T12:00:00Z' },
        { summary: 'User felt calm after meditation.', createdAt: '2026-05-16T12:00:00Z' },
      ];

      const context = buildCrossSessionContext(blobs);

      expect(context).toContain('[PREVIOUS SESSION CONTEXT]');
      expect(context).toContain('- (2026-05-15): User discussed anxiety.');
      expect(context).toContain('- (2026-05-16): User felt calm after meditation.');
    });

    test('handles empty blobs gracefully', () => {
      expect(buildCrossSessionContext([])).toBe('');
      expect(buildCrossSessionContext(null)).toBe('');
    });

    test('respects character limit constraints', () => {
      const longSummary = 'A'.repeat(_internals.MAX_CHARS + 100);
      const blobs = [{ summary: longSummary, createdAt: '2026-05-15T12:00:00Z' }];

      const context = buildCrossSessionContext(blobs);
      expect(context.length).toBeLessThanOrEqual(_internals.MAX_CHARS + 100); // Should fit or skip depending on exact math
    });
  });

  describe('buildMemoryContext (refactored)', () => {
    test('merges crossSessionContext and vector memories cleanly', () => {
      const crossSession = '[PREVIOUS SESSION CONTEXT]\n- (2026-05-15): User was anxious.';
      const vectorMems = [
        { text: 'User loves hiking.' },
        { text: 'User works as a teacher.' }
      ];

      const result = buildMemoryContext(vectorMems, crossSession);

      expect(result).toContain('[PREVIOUS SESSION CONTEXT]');
      expect(result).toContain('- (2026-05-15): User was anxious.');
      expect(result).toContain('[RELEVANT PAST MEMORIES]');
      expect(result).toContain('[1] User loves hiking.');
      expect(result).toContain('[2] User works as a teacher.');
    });

    test('handles only crossSessionContext present', () => {
      const crossSession = '[PREVIOUS SESSION CONTEXT]\n- (2026-05-15): User was anxious.';
      const result = buildMemoryContext([], crossSession);

      expect(result).toBe(crossSession);
    });

    test('handles only vector memories present', () => {
      const vectorMems = [{ text: 'User loves hiking.' }];
      const result = buildMemoryContext(vectorMems);

      expect(result).toContain('[RELEVANT PAST MEMORIES]');
      expect(result).toContain('[1] User loves hiking.');
      expect(result).not.toContain('[PREVIOUS SESSION CONTEXT]');
    });

    test('handles empty inputs', () => {
      expect(buildMemoryContext([], '')).toBe('');
      expect(buildMemoryContext(null, null)).toBe('');
    });
  });
});
