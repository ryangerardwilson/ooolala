import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const basePath = process.env.OOOLALA_WEB_BASE_PATH || '/';
const base = basePath === '/' ? '/' : `/${basePath.replace(/^\/+|\/+$/g, '')}/`;

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
