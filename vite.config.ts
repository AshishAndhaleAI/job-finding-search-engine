import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Freebuff runs the dev server in a managed background session.
// server.hmr must stay disabled, and the server must bind to 0.0.0.0
// using the PORT that Freebuff injects for isolated workspaces.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    hmr: false,
    // In local dev the Convex backend runs on 127.0.0.1:3210. Proxying the
    // storage upload endpoint through the app server keeps file uploads
    // same-origin — no CORS preflight, no cross-proxy hops, reliable in the
    // Freebuff preview and on localhost. (Production uses Convex Cloud URLs,
    // which bypass this entirely.)
    proxy: {
      "/api/storage": {
        target: "http://127.0.0.1:3210",
        changeOrigin: true,
      },
    },
  },
});
