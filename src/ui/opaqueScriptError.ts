/**
 * Browsers replace an error they won't expose to page script (a cross-origin
 * script, or code injected by an extension, content blocker, or in-app
 * browser) with the bare message "Script error." and no error object. Nothing
 * in it points at our code or can be acted on, so the global `error` handler
 * records it without raising the crash dialog.
 */
export function isOpaqueScriptError(event: Pick<ErrorEvent, 'error' | 'message'>): boolean {
  return !event.error && /^Script error\.?$/i.test(String(event.message ?? '').trim());
}
