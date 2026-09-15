import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

declare const process: any;

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
    },
    base: './',
    build: {
      emptyOutDir: false,
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
