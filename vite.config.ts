import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Dev-only middleware so `npm run dev` works without Netlify Functions.
// Mirrors netlify/functions/gemini.mjs — key stays server-side in dev too.
const geminiDevProxy = (mode: string): Plugin => ({
  name: 'gemini-dev-proxy',
  configureServer(server) {
    const env = loadEnv(mode, '.', '');
    const apiKey = env.GEMINI_API_KEY;
    const MODEL = 'gemini-2.5-flash';

    server.middlewares.use('/api/gemini', async (req, res) => {
      if (!apiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set in .env.local' }));
        return;
      }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload?.contents) throw new Error('Missing contents');
          // REST API needs contents = array of {parts:[...]}; normalize like
          // netlify/functions/gemini.mjs does.
          let contents = payload.contents;
          if (typeof contents === 'string') {
            contents = [{ parts: [{ text: contents }] }];
          } else if (!Array.isArray(contents) && contents.parts) {
            contents = [contents];
          }
          const apiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify({ contents }),
            },
          );
          const data = await apiRes.json().catch(() => ({}));
          const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
          res.statusCode = apiRes.ok && text ? 200 : apiRes.status === 429 ? 429 : 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(apiRes.ok && text ? { text } : { error: data?.error?.message || `Gemini API error (HTTP ${apiRes.status})` }));
        } catch (err) {
          console.error('gemini-dev-proxy error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Failed to reach Gemini API.' }));
        }
      });
    });
  },
});

export default defineConfig(({ mode }) => {
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          manifest: {
            name: 'Handwriting AI',
            short_name: 'HandwritingAI',
            description: 'Capture, recognize, and translate handwritten notes instantly',
            theme_color: '#4f46e5',
            icons: [
              {
                src: 'pwa-192x192.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
              },
              {
                src: 'pwa-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp}'],
          },
        }),
        geminiDevProxy(mode),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
