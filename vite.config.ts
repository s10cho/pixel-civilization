import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works under the GitHub Pages sub-path (/pixel-civilization/).
  base: './',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; silence the default 500 kB warning.
    chunkSizeWarningLimit: 2000,
  },
});
