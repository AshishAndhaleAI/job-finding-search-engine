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
  },
});
