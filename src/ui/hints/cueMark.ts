/**
 * Marks a HUD slot as the move the moment calls for (`actionCues.ts`): it glows, and a
 * chip above it names its key and verb ("⇧1 Drink"). A null label clears the mark.
 * Styled by `.hud-cue` in layout.css.
 */
export function markCue(el: HTMLElement, label: string | null): void {
  el.classList.toggle('hud-cue', !!label);
  if (label) el.dataset.cue = label;
  else delete el.dataset.cue;
}
