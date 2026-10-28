// Whether a push to main ships anything to players (.github/workflows/deploy.yml). Every push runs the gates; a
// push whose files all match NON_SHIPPING skips the browser runs and the Pages deploy, since the site would be
// rebuilt byte for byte the same (29 of 40 deploys before 28 Oct). Any other file, a push whose files can't be
// listed, and a manual run all ship. Types: deploy-scope.d.mts.

// Never in the bundle, and never read by the browser tests: docs and instructions, tooling, the gates' own
// scripts, Vitest suites and fixtures, the soak and the recording demo (outside every gate), the relay (deployed
// on its own) and the pull-request workflow.
export const NON_SHIPPING = [
  /^docs\//,
  /^(?!src\/)[^]*\.md$/,
  /^\.(claude|agents|githooks|prompts|sonarlint|vscode)\//,
  /^\.github\/ISSUE_TEMPLATE\//,
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\//,
  /^tests\//,
  /^relay\//,
  /^src\/(?:.+\/)?(?:__tests__|__fixtures__)\//,
  /^src\/.+\.test\.ts$/,
  /^e2e\/soak\//,
  /^e2e\/(?:soak|gameplay-record)\.spec\.ts$/,
  /^(?:knip\.json|\.gitignore|\.gitattributes|\.editorconfig)$/,
];

// `files`: the paths the push changed, or null when they could not be listed (a new branch, a force-push).
export function deployScope(files, event = 'push') {
  if (event !== 'push') return { ships: true, why: `a ${event} run always deploys` };
  if (!files) return { ships: true, why: 'the files this push changed could not be listed' };
  const shipping = files.filter((f) => !NON_SHIPPING.some((re) => re.test(f)));
  if (files.length === 0) return { ships: false, why: 'the push changed no file' };
  if (shipping.length) return { ships: true, why: `it changes ${shipping.slice(0, 3).join(', ')}${shipping.length > 3 ? ` and ${shipping.length - 3} more` : ''}` };
  return { ships: false, why: `its ${files.length} file${files.length === 1 ? '' : 's'} ship nothing (docs, tooling, tests): gates only` };
}
