import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:3333';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento o frontend fala com a API pelo mesmo origin,
    // evitando CORS e mantendo os caminhos iguais aos de producao.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          flow: ['@xyflow/react'],
        },
      },
    },
  },
});
