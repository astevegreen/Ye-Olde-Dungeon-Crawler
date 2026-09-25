import { describe, expect, it } from 'vitest';
import { isOpaqueScriptError } from '../opaqueScriptError';

describe('isOpaqueScriptError', () => {
  it('flags the browser-sanitized "Script error." with no error object (issue #4)', () => {
    expect(isOpaqueScriptError({ error: null, message: 'Script error.' })).toBe(true);
    expect(isOpaqueScriptError({ error: undefined, message: 'Script error' })).toBe(true);
  });

  it('does not flag a real error, even if its message matches', () => {
    expect(isOpaqueScriptError({ error: new Error('Script error.'), message: 'Script error.' })).toBe(false);
  });

  it('does not flag an ordinary message without an error object', () => {
    expect(isOpaqueScriptError({ error: null, message: 'Uncaught TypeError: x is undefined' })).toBe(false);
  });
});
