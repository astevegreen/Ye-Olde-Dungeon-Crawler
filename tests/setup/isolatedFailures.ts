/**
 * An isolated failure (ARCHITECTURE.md §4) is an error the engine caught so play goes on. In a
 * test it would go unseen, a crash inside an action reading as a rejected move, so the Vitest
 * setup (tests/setup/sharedState.ts) fails any test the flight recorder caught an error in.
 * A test that causes one on purpose says so first.
 */
let allowed = false;

/** This test causes isolated failures on purpose; call it in the test or its `beforeEach`. */
export function allowIsolatedFailures(): void {
  allowed = true;
}

/** Whether the test just run allowed them, resetting for the next. For the setup file only. */
export function takeIsolatedFailureAllowance(): boolean {
  const was = allowed;
  allowed = false;
  return was;
}
