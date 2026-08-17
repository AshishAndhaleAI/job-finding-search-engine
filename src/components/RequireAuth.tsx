import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useConvexAuth } from "@convex-dev/auth/react";
import { Radar } from "lucide-react";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="relative flex size-16 items-center justify-center">
          <span className="sonar-ring absolute inset-0 rounded-full border border-primary/40" />
          <span
            className="sonar-ring absolute inset-0 rounded-full border border-primary/40"
            style={{ animationDelay: "1.1s" }}
          />
          <Radar className="size-7 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Scanning for your workspace…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
