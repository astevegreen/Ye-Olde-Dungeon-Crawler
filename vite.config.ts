import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

declare const process: any;

// Shown on the title screens (src/ui/branding.ts), so the UI never claims a version the build isn't.
const APP_VERSION: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version;

// Commit the bundle was built from, stamped into bug reports: the single-file bundle is
// minified, so a stack position means nothing until it is mapped to the build that made it.
function resolveBuildId(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown';
  }
}
const BUILD_ID = resolveBuildId();

// Browser file:// security treats ES module scripts (<script type="module" crossorigin>)
// as unique/opaque origins and throws CORS security errors on local files.
// Converting inlined scripts to classic scripts (<script>) guarantees 100% offline,
// zero-CORS compatibility across all Chromium and WebKit browsers when opened via file://.
function cleanScriptForFileProtocol(targetTheme: string): Plugin {
  return {
    name: 'clean-script-for-file-protocol',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && typeof file.source === 'string' && file.fileName.endsWith('.html')) {
          file.source = file.source.replace(/<script\s+type="module"\s+crossorigin>/gi, '<script>');

          if (targetTheme === 'warcraft') {
            file.fileName = 'warcraft.html';
          } else {
            file.fileName = 'index.html';
            this.emitFile({
              type: 'asset',
              fileName: 'cotw.html',
              source: file.source,
            });
          }
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const theme = process.env.THEME || (mode !== 'production' && mode !== 'development' ? mode : 'cotw');

  return {
    plugins: [
      viteSingleFile(),
      cleanScriptForFileProtocol(theme),
    ],
    define: {
      'import.meta.env.VITE_THEME': JSON.stringify(theme),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
    },
    base: './',
    // Keep class names through minification: the action pipeline reports
    // `action.constructor.name` as the hook-matching actionType (ARCHITECTURE.md §4),
    // so content hooks filtering on e.g. 'MovementAction' match only if names survive.
    esbuild: {
      keepNames: true,
    },
    build: {
      emptyOutDir: false,
      // SOURCEMAP=hidden (the deploy workflow) writes .map files with no reference from the
      // bundle; CI keeps them as a build artifact so crash positions can be mapped to source.
      sourcemap: process.env.SOURCEMAP === 'hidden' ? 'hidden' : false,
      assetsInlineLimit: 100000000,
      cssCodeSplit: false,
      target: 'esnext',
      modulePreload: {
        polyfill: false,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    test: {
      environment: 'node',
      exclude: [...configDefaults.exclude, 'e2e/**', '**/.claude/**'],
    },
  };
});
