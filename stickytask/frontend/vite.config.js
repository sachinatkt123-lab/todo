import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy keeps the frontend on :5173 while calling the API on :3001
// without CORS headaches.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/tasks': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
});
