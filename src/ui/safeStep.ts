/**
 * Runs one step of a presentation sequence so that its failure cannot stop the steps
 * after it: a storage write ahead of the death screen (R-stor-9), one HUD widget ahead of
 * the map redraw (R-main-8). A throw goes to `onError` instead of the caller.
 * Returns whether the step completed.
 */
export function safely(label: string, step: () => void, onError: (err: Error, label: string) => void): boolean {
  try {
    step();
    return true;
  } catch (thrown) {
    onError(thrown instanceof Error ? thrown : new Error(String(thrown)), label);
    return false;
  }
}
