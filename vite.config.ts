import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  // Development credentials are handed to the browser by `vite dev` and by nothing else. Vite
  // inlines every VITE_* variable it can see, dead branches included, so a build must never be
  // allowed to see these: one left in .env.local would otherwise end up in the bundle.
  const devEnv = command === 'serve' ? loadEnv(mode, new URL('.', import.meta.url).pathname, 'VITE_') : {};

  return {
    // Relative base so the build works under the GitHub Pages sub-path (/pixel-civilization/).
    base: './',
    define: {
      __DEV_ANTHROPIC_KEY__: JSON.stringify(devEnv.VITE_ANTHROPIC_API_KEY ?? ''),
      __DEV_GEMINI_KEY__: JSON.stringify(devEnv.VITE_GEMINI_API_KEY ?? ''),
    },
    server: {
      port: 5173,
    },
    build: {
      target: 'es2022',
      // three.js is most of the bundle (~700 kB minified); silence the default 500 kB warning.
      chunkSizeWarningLimit: 1200,
    },
  };
});
