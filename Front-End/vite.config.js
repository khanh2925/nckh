import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendUrl = process.env.AIRPORT_MAP_API_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // host: true lets a phone on the same Wi-Fi open http://<your-PC-IP>:5173
    host: true,
    proxy: {
      '/api': backendUrl
    }
  }
});
