import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            // Whether to polyfill `node:` protocol imports
            protocolImports: true,
          }),
    ],
    build: {
        chunkSizeWarningLimit: 1000,
    },
    preview: {
        port: 1234,
    },
    server: {
        port: 1234,
        cors: true, // This will disable CORS restrictions for the dev server
        proxy: {
          '/lavanet.lava.pairing.BadgeGenerator': {
            target: 'https://badges.lavanet.xyz',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path
          }
        }
      },
    resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
            // This is needed for some packages that expect these Node.js modules
            path: 'path-browserify',
            stream: 'stream-browserify',
            crypto: 'crypto-browserify',
          },
    }
});
