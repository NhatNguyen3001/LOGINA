import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Publishes the build's commit so open tabs can tell when a newer version is live. */
const versionFile = (): Plugin => ({
  name: 'logina-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: process.env.VITE_BUILD_SHA || 'dev' }) });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8090' } },
});
