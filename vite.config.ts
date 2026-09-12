import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works under the GitHub Pages sub-path (/pixel-civilization/).
  base: './',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    // three.js is most of the bundle (~700 kB minified); silence the default 500 kB warning.
    chunkSizeWarningLimit: 1200,
  },
});
