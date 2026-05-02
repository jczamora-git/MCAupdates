import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from 'vite-plugin-pwa';
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Custom plugin: replaces __FIREBASE_API_KEY__ placeholder in firebase-messaging-sw.js
// so the real key never lives in a committed file.
function injectFirebaseSWEnv(): import('vite').Plugin {
  const swFileName = 'firebase-messaging-sw.js';

  return {
    name: 'inject-firebase-sw-env',
    // Dev: intercept requests for the service worker and inject env vars on the fly
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== `/${swFileName}`) return next();
        const swPath = path.resolve(__dirname, 'public', swFileName);
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content.replace('__FIREBASE_API_KEY__', process.env.VITE_FIREBASE_API_KEY ?? '');
        res.setHeader('Content-Type', 'application/javascript');
        res.end(content);
      });
    },
    // Build: replace placeholder in the output file after Vite copies public/ assets
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const swOut = path.join(outDir, swFileName);
      if (!fs.existsSync(swOut)) return;
      let content = fs.readFileSync(swOut, 'utf-8');
      content = content.replace('__FIREBASE_API_KEY__', process.env.VITE_FIREBASE_API_KEY ?? '');
      fs.writeFileSync(swOut, content, 'utf-8');
    }
  };
}

// https://vitejs.dev/config/
// HTTPS disabled for development - uncomment below if needed for production testing
// const certDir = path.resolve(__dirname, "./certs");
// const certPath = path.join(certDir, "localhost.pem");
// const keyPath = path.join(certDir, "localhost-key.pem");
// const httpsConfig = fs.existsSync(certPath) && fs.existsSync(keyPath)
//   ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
//   : undefined;

export default defineConfig(({ mode }) => {
  // Load env file so plugins can access VITE_* vars (process.env is populated by loadEnv)
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);
  const defaultBase = mode === 'production' ? '/ui/' : '/';
  const configuredBase = (env.VITE_PUBLIC_BASE || defaultBase).trim();
  const normalizedBase = configuredBase.startsWith('/') ? configuredBase : `/${configuredBase}`;
  const base = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;

  return {
  // Public base path (defaults: '/ui/' in production, '/' in development).
  // Override with VITE_PUBLIC_BASE when needed.
  base,
  server: {
    host: "::",
    port: 5174,
    proxy: {
      '/uploads': {
        // Proxy uploaded file requests to the PHP backend
        // PHP server root is LavaLust/, files live at LavaLust/public/uploads/
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path: string) => '/public' + path,
      },
      '/api': {
        // Proxy API requests to the PHP backend (PHP dev server at localhost:3000)
        target: 'http://localhost:3000',
        changeOrigin: false,  // Keep origin as localhost:5174 for cookie domain
        secure: false,
        cookieDomainRewrite: '',  // Remove Domain so cookie binds to current host (e.g., LAN IP)
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward cookies from the original request
            if (req.headers && req.headers.cookie) {
              proxyReq.setHeader('cookie', req.headers.cookie as string);
            }
          });

        }
      }
    }
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    injectFirebaseSWEnv(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'fonts/**/*'],
      manifest: {
        name: 'EduTrack - Maranatha Christian Academy',
        short_name: 'EduTrack',
        description: 'Student enrollment and payment management system',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: base,
        start_url: base,
        icons: [
          {
            src: `${base}icon-72x72.png`,
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-96x96.png`,
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-128x128.png`,
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-144x144.png`,
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-152x152.png`,
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-384x384.png`,
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icon-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}', '**/icon-*.png', '**/apple-splash-*.png'],
        globIgnores: ['**/logo.png', '**/school-logo.png', '**/school-with-text-logo*.png'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // PWA testing will be done in production deployment
        type: 'module'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
