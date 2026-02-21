// vite.config.ts (or vite.config.js)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // allow external access
    allowedHosts: ["3999-103-58-73-163.ngrok-free.app"], // your ngrok host
    proxy: {
      /**
       * Any request starting with /pdf will be proxied to storage.googleapis.com
       * Example client URL:
       *   /pdf/mastermind-1e2c1.firebasestorage.app/notes/FILE.pdf?...sig...
       *
       * Resulting upstream URL:
       *   https://storage.googleapis.com/mastermind-1e2c1.firebasestorage.app/notes/FILE.pdf?...sig...
       */
      "/pdf": {
        target: "https://storage.googleapis.com",
        changeOrigin: true,
        secure: true,
        /**
         * Keep the path after /pdf as-is. We only strip the /pdf prefix.
         * /pdf/<bucket>/<object>?query -> /<bucket>/<object>?query
         */
        rewrite: (path) => path.replace(/^\/pdf/, ""),
        // Optional: increase timeouts for large PDFs
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            // You can modify headers if ever needed, e.g.:
            // proxyReq.setHeader('accept-encoding', 'identity');
          });
        },
      },
    },
  },
});
