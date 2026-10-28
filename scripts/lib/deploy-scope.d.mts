/** Types for `deploy-scope.mjs`, which `scripts/deploy-scope.mjs` runs under plain node in CI. */

export const NON_SHIPPING: readonly RegExp[];
export function deployScope(files: readonly string[] | null, event?: string): { ships: boolean; why: string };
