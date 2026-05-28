import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://localhost:4173';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': API_TARGET,
      '/photos': API_TARGET,
    },
  },
});
