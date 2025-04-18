import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
    plugins: [
        react(),
    ],
    build: {
        chunkSizeWarningLimit: 1000,
    },
    preview: {
        port: 1234,
    },
    server: {
        host: '0.0.0.0', // Bind to all interfaces
        port: 1234,
      },
    resolve: {
        dedupe: ['react', 'react-dom']
    },
});
