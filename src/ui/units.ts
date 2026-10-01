/**
 * Weight as players read it. The engine counts grams; every screen shows kilograms,
 * because a bare "g" beside coins reads as gold.
 */
export function formatKg(grams: number): string {
  const kg = grams / 1000;
  // Under a kilogram two decimals keep light items distinguishable (0.12 kg).
  const text = kg < 1 ? kg.toFixed(2) : kg.toFixed(1);
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** "0.12 kg", "8.7 kg". */
export function formatWeight(grams: number): string {
  return `${formatKg(grams)} kg`;
}

/** "8.7 / 27.5 kg": a load against its limit. */
export function formatLoad(grams: number, limitGrams: number): string {
  return `${formatKg(grams)} / ${formatKg(limitGrams)} kg`;
}
