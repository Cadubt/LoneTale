import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:3333';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento o frontend fala com a API pelo mesmo origin,
    // evitando CORS e mantendo os caminhos iguais aos de producao.
    //
    // `/media` segue o mesmo caminho: em producao os arquivos virao de um
    // armazenamento separado (Azure Blob), mas em desenvolvimento quem os serve
    // e o backend -- e o servidor de pre-visualizacao devolve imagens de
    // exemplo geradas na hora, para que nenhuma cena fique sem ilustracao.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/media': { target: API_TARGET, changeOrigin: true },
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
