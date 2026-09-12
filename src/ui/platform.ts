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
 * No-op adapter for headless/test environments where DOM is unavailable.
 */
export const noopPlatformAdapter: PlatformAdapter = {
  triggerFileDownload(_filename: string, _content: string, _mimeType: string): void {
    // No-op in headless/test environments
  },
};

/**
 * Copies text to the system clipboard with cross-browser and file:/// protocol fallback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  let copied = false;

  // Modern asynchronous Clipboard API (requires secure context)
  if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
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

