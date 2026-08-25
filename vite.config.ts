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
    const useOpenRouter = Boolean(env.OPENROUTER_API_KEY);
    const apiKey = useOpenRouter ? env.OPENROUTER_API_KEY : env.GEMINI_API_KEY;
    const GEMINI_MODEL = 'gemini-3.6-flash';
    const OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';

    // Convert Gemini-style contents to OpenAI chat messages.
    const toOpenRouterMessages = (contents: any) => {
      const parts = Array.isArray(contents) ? contents.flatMap((c: any) => c.parts || []) : contents.parts || [];
      return [{
        role: 'user',
        content: parts.map((p: any) =>
          p.text
            ? { type: 'text', text: p.text }
            : { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } },
        ),
      }];
    };

    server.middlewares.use('/api/gemini', async (req, res) => {
      if (!apiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'No API key set in .env.local (OPENROUTER_API_KEY or GEMINI_API_KEY)' }));
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
          let apiRes: Response, text = '', errName = 'AI';
          if (useOpenRouter) {
            apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: OPENROUTER_MODEL, messages: toOpenRouterMessages(contents), max_tokens: 2048 }),
            });
            const data = await apiRes.json().catch(() => ({} as any));
            if (!apiRes.ok) errName = 'OpenRouter';
            else text = data?.choices?.[0]?.message?.content || '';
          } else {
            apiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({ contents }),
              },
            );
            const data = await apiRes.json().catch(() => ({} as any));
            if (!apiRes.ok) errName = 'Gemini';
            else text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
          }
          res.statusCode = apiRes.ok && text.trim() ? 200 : apiRes.status === 429 ? 429 : 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(apiRes.ok && text.trim() ? { text } : { error: (apiRes.status === 429 ? 'Rate limit reached — try again in a minute.' : null) || `${errName} API error (HTTP ${apiRes.status})` }));
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
