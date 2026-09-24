import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Fail loudly if 5173 is taken (e.g. by an old prototype server) instead of silently moving to another port.
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
