/**
 * Utility functions for sanitizing sensitive or user-identifying data
 * (such as local file system paths) from diagnostic packages and error stacks.
 */

/**
 * Scrubs user directory paths and file:/// URIs from text to protect player privacy.
 * Replaces absolute user home/profile paths with generic placeholders:
 * - `C:\Users\username\...` -> `<user-dir>\...`
 * - `/Users/username/...` -> `<user-dir>/...`
 * - `/home/username/...` -> `<user-dir>/...`
 * - `file:///C:/Users/username/...` -> `file:///<user-dir>/...`
 */
export function sanitizePaths(text: string): string {
  if (!text) return text;
  return text
    // Replace file:/// URLs pointing to user directory: file:///C:/Users/Alice/... or file:///home/alice/...
    .replace(/file:\/\/\/(?:[A-Za-z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/)[^\\/]+([\\/])/gi, 'file:///<user-dir>$1')
    // Replace Windows user path: C:\Users\Alice\... or C:/Users/Alice/...
    .replace(/(?:[A-Za-z]:[\\/]+Users[\\/]+)[^\\/]+([\\/])/gi, '<user-dir>$1')
    // Replace Unix user path: /Users/Alice/... or /home/alice/...
    .replace(/(?:\/(?:Users|home)\/)[^/]+(\/)/g, '<user-dir>$1');
}
