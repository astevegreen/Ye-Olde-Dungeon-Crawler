import { describe, expect, it } from 'vitest';
import { isBenignResizeObserverError, isOpaqueScriptError } from '../opaqueScriptError';

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

describe('isBenignResizeObserverError', () => {
  it('matches the browser\'s deferred-notification messages without an error object', () => {
    expect(isBenignResizeObserverError({ error: null, message: 'ResizeObserver loop completed with undelivered notifications.' })).toBe(true);
    expect(isBenignResizeObserverError({ error: undefined, message: 'ResizeObserver loop limit exceeded' })).toBe(true);
  });

  it('leaves real errors alone', () => {
    expect(isBenignResizeObserverError({ error: new Error('x'), message: 'ResizeObserver loop limit exceeded' })).toBe(false);
    expect(isBenignResizeObserverError({ error: null, message: 'TypeError: foo is undefined' })).toBe(false);
  });
});
