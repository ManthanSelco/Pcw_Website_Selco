import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // public/assets holds the Webflow files, so React's own bundle goes to /app
    assetsDir: 'app',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/cdn': 'http://localhost:4000',
    },
  },
});
