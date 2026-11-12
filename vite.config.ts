import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'kitchen-sync.json');

function crossDeviceSyncPlugin(): Plugin {
  const attach = (middlewares: any) => {
    middlewares.use('/api/sync', (req: any, res: any, next: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET') {
        if (fs.existsSync(DATA_FILE)) {
          res.end(fs.readFileSync(DATA_FILE, 'utf-8'));
        } else {
          res.end('null');
        }
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            fs.writeFileSync(DATA_FILE, body, 'utf-8');
            res.end(JSON.stringify({ ok: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e?.message || 'write error' }));
          }
        });
        return;
      }
      next();
    });
  };
  return {
    name: 'cross-device-sync',
    configureServer(server) { attach(server.middlewares); },
    configurePreviewServer(server) { attach(server.middlewares); },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    crossDeviceSyncPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pink Kitchen — Nutrition, Inventory & Grocery Planner',
        short_name: 'Pink Kitchen',
        description: 'Personal kitchen inventory, meal planner, recipes, nutrition and smart grocery lists.',
        theme_color: '#2f6b4f',
        background_color: '#f7f6f2',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: { host: true, port: 5173 },
  test: { environment: 'node' },
} as any);
