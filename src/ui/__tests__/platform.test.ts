import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copyTextToClipboard } from '../platform';

describe('copyTextToClipboard Cross-Browser Fallback', () => {
  let origWindow: any;
  let origDocument: any;
  let origNavigatorDesc: PropertyDescriptor | undefined;

  beforeEach(() => {
    origWindow = (globalThis as any).window;
    origDocument = (globalThis as any).document;
    origNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
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

    if (origNavigatorDesc) {
      try {
        Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
      } catch {
        // Ignore restore error in test runner
      }
    }
  });

  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).window = { isSecureContext: true };
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: writeTextMock } },
      configurable: true,
      writable: true,
    });

    const success = await copyTextToClipboard('Test telemetry data');
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Test telemetry data');
  });

  it('falls back to off-screen textarea execCommand copy when clipboard rejects (permission failure)', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    (globalThis as any).window = { isSecureContext: true };
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: writeTextMock } },
      configurable: true,
      writable: true,
    });

    const execMock = vi.fn().mockReturnValue(true);
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
    expect(writeTextMock).toHaveBeenCalledWith('Fallback diagnostic report');
    expect(execMock).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when navigator is undefined without throwing ReferenceError', async () => {
    (globalThis as any).window = { isSecureContext: true };
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const execMock = vi.fn().mockReturnValue(true);
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

    const success = await copyTextToClipboard('Fallback when navigator undefined');
    expect(success).toBe(true);
    expect(execMock).toHaveBeenCalledWith('copy');
  });

  it('falls back to textarea copy in an insecure context', async () => {
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

    const success = await copyTextToClipboard('Insecure context copy');
    expect(success).toBe(true);
    expect(execMock).toHaveBeenCalledWith('copy');
  });

  it('returns false gracefully when both clipboard API and fallback fail', async () => {
    (globalThis as any).window = { isSecureContext: false };
    (globalThis as any).document = {
      createElement: vi.fn().mockImplementation(() => {
        throw new Error('DOM manipulation failed');
      }),
    };

    const success = await copyTextToClipboard('Will fail gracefully');
    expect(success).toBe(false);
  });
});
