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
    // In local dev the Convex backend runs on 127.0.0.1:3210. The browser talks
    // ONLY to this app's own origin: every Convex request AND its WebSocket
    // (`/api/sync`) are proxied here. This keeps auth, data and file uploads
    // same-origin and avoids the flaky separate backend proxy in the Freebuff
    // preview. (Production uses Convex Cloud URLs, which bypass this entirely.)
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3210",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
