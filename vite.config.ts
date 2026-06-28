import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Reddit's public *.json often 403s anonymous browser origins / blocks CORS.
    // Proxy it through the dev server so the browser sees a same-origin request and
    // Reddit sees a server-side one with a real User-Agent. See src/sources/reddit.ts.
    proxy: {
      '/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/reddit/, ''),
        headers: { 'User-Agent': 'inner-weather/0.1 (dev proxy)' },
      },
      // Oura's API host is not CORS-enabled for browser origins, so a direct call
      // from localhost would be blocked. Proxy /oura/* same-origin and let Vite
      // forward it server-side. Dev/preview only — fine for the demo run.
      '/oura': {
        target: 'https://api.ouraring.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/oura/, ''),
      },
      // You.com's Search API (ydc-index.io) sends no Access-Control-Allow-Origin and
      // 403s the CORS preflight, so a browser fetch with the X-API-Key header is blocked
      // cross-origin. Proxy /youcom/* same-origin; the client-sent X-API-Key passes
      // through. See src/sources/youcom.ts. Dev/preview only — fine for the demo run.
      '/youcom': {
        target: 'https://ydc-index.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/youcom/, ''),
      },
    },
  },
})
