import type { StorageAdapter } from '../engine';

/**
 * PlatformAdapter — isolates browser-specific DOM operations from the engine layer.
 * Inject a no-op adapter in headless/test environments.
 */
export interface PlatformAdapter {
  /** Triggers a file download in the browser. */
  triggerFileDownload(filename: string, content: string, mimeType: string): void;
}

/**
 * Default browser implementation using Blob + anchor element download.
 */
export const defaultPlatformAdapter: PlatformAdapter = {
  triggerFileDownload(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

/**
 * Copies text to the system clipboard with cross-browser and file:/// protocol fallback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  let copied = false;

  // Modern asynchronous Clipboard API (requires secure context)
  try {
    if (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }

  // Cross-browser synchronous fallback for file:/// URLs or restricted clipboard contexts
  if (!copied && typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch {
      copied = false;
    }
  }

  return copied;
}

/**
 * Retrieves browser localStorage as StorageAdapter, or null in headless contexts.
 */
export function getBrowserStorage(): StorageAdapter | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}


/** Saves a data URL (e.g. a canvas screenshot) as a file. */
export function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Browser details a diagnostic report needs. The engine can't read them itself
 * (headless purity, ARCHITECTURE.md §2), so presentation passes them in; without
 * them a report reads "Headless / Pure Engine" at a default 960x600. */
export function browserReportContext(): {
  userAgent?: string;
  devicePixelRatio?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  appVersion?: string;
  buildId?: string;
} {
  const build = { appVersion: import.meta.env.VITE_APP_VERSION, buildId: import.meta.env.VITE_BUILD_ID };
  if (typeof window === 'undefined') return build;
  return {
    ...build,
    userAgent: window.navigator?.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}
