import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Loader2, Radar } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { cn } from "../lib/utils";

const redirectAfterAuth = "/app";

export default function AuthPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || redirectAfterAuth;

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    navigate(returnTo, { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", { email, password, flow });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <div className="radar-grid relative hidden items-center justify-center overflow-hidden border-r border-border/60 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.14),transparent_60%)]" />
        <div className="relative max-w-md">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600 shadow-lg shadow-cyan-500/20">
              <Radar className="size-5 text-slate-950" />
            </span>
            <span className="font-display text-xl font-bold">
              First<span className="text-primary">Step</span>
            </span>
          </div>
          <h1 className="mt-10 font-display text-3xl font-bold leading-tight">
            Set it up once.
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Let the engine work.
            </span>
          </h1>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            {[
              "Target roles, skills, location — set once",
              "Searches entry-level jobs worldwide every day",
              "Email updates for every application and offer",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(34,211,238,0.6)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600">
                <Radar className="size-5 text-slate-950" />
              </span>
              <span className="font-display text-lg font-bold">
                First<span className="text-primary">Step</span>
              </span>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">
                {flow === "signIn" ? "Welcome back" : "Create your engine"}
              </CardTitle>
              <CardDescription>
                {flow === "signIn"
                  ? "Sign in to check your applications."
                  : "Takes under a minute — no experience needed."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(["signIn", "signUp"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFlow(f);
                      setError(null);
                    }}
                    className={cn(
                      "rounded-md py-1.5 text-sm font-medium transition-colors",
                      flow === f
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f === "signIn" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@university.edu"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {flow === "signIn" ? "Signing in…" : "Creating account…"}
                    </>
                  ) : flow === "signIn" ? (
                    "Sign in"
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                {flow === "signIn" ? "New to FirstStep?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
                  className="font-medium text-primary hover:underline"
                >
                  {flow === "signIn" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
