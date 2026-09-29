import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, forward API and WebSocket traffic to the Node server
// so the browser only ever talks to one origin (no CORS headaches).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
