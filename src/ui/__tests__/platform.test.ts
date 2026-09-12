import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copyTextToClipboard } from '../platform';

describe('copyTextToClipboard Cross-Browser Fallback', () => {
  let origWindow: any;
  let origDocument: any;
  let origClipboard: any;

  beforeEach(() => {
    origWindow = (globalThis as any).window;
    origDocument = (globalThis as any).document;
    origClipboard = (globalThis as any).navigator?.clipboard;
  });

  afterEach(() => {
    if (origWindow !== undefined) {
      (globalThis as any).window = origWindow;
    } else {
      delete (globalThis as any).window;
    }

    if (origDocument !== undefined) {
      (globalThis as any).document = origDocument;
    } else {
      delete (globalThis as any).document;
    }

    if (globalThis.navigator) {
      try {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          value: origClipboard,
          configurable: true,
          writable: true,
        });
      } catch {
        // Ignore restore error in test runner
      }
    }
  });

  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).window = { isSecureContext: true };
    if (globalThis.navigator) {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true,
      });
    }

    const success = await copyTextToClipboard('Test telemetry data');
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Test telemetry data');
  });

  it('falls back to off-screen textarea execCommand copy when clipboard rejects or insecure context', async () => {
    const execMock = vi.fn().mockReturnValue(true);
    (globalThis as any).window = { isSecureContext: false };
    const dummyElem = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(dummyElem),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: execMock,
    };

    const success = await copyTextToClipboard('Fallback diagnostic report');
    expect(success).toBe(true);
    expect(execMock).toHaveBeenCalledWith('copy');
  });
});
