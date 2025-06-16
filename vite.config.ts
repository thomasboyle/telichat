import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Plugin to copy jackybot.jpg to dist/assets during build
    {
      name: 'copy-assets',
      writeBundle() {
        const srcPath = path.join(__dirname, 'src/assets/jackybot.jpg')
        const distPath = path.join(__dirname, 'dist/assets/jackybot.jpg')
        
        // Ensure dist/assets directory exists
        const distAssetsDir = path.dirname(distPath)
        if (!fs.existsSync(distAssetsDir)) {
          fs.mkdirSync(distAssetsDir, { recursive: true })
        }
        
        // Copy jackybot.jpg if it exists
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, distPath)
          console.log('✓ Copied jackybot.jpg to dist/assets/')
        }
      }
    },
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
  server: {
    proxy: {
      // Proxy API requests to LM Studio
      '/api/lm-studio': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lm-studio/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to LM Studio:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from LM Studio:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
})
