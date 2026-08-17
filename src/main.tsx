import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./index.css";

import { resolveConvexUrl } from "./lib/convex";

const convexUrl = resolveConvexUrl();
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

if (!convexUrl) {
  createRoot(rootEl).render(
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="font-display text-xl font-semibold">Convex is not configured</h1>
        <p className="text-sm text-muted-foreground">
          The <code className="rounded bg-muted px-1.5 py-0.5">VITE_CONVEX_URL</code> environment
          variable is missing. Run <code className="rounded bg-muted px-1.5 py-0.5">bun convex dev</code>{" "}
          once to create a local deployment — it writes <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>{" "}
          automatically.
        </p>
      </div>
    </div>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  createRoot(rootEl).render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConvexAuthProvider>
      </ConvexProvider>
    </StrictMode>,
  );
}
