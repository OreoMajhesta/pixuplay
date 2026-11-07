import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [react(), svelte()],
  server: {
    host: '0.0.0.0',
    port: 20006,
    proxy: {
      '/api': {
        target: 'http://localhost:15006',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:15006',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
});
