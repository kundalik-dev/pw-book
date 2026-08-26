import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // The monorepo has a single root `.env` (see README.md), not a
  // per-workspace one — point Vite's env loading at the repo root.
  envDir: path.resolve(__dirname, '../..'),
  server: {
    port: 5173,
  },
});
