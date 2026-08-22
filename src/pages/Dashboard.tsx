import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  AlertTriangle,
  BellRing,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  MailCheck,
  Radar,
  Rocket,
  Settings2,
  UploadCloud,
  UserRound,
  XCircle,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
// Note: scanResume is the Convex action that parses the uploaded resume
// using pdf-parse/mammoth. It runs on the backend ("use node") so
// no API keys are needed — 100% free.
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { rewriteConvexUrl } from "../lib/convex";

type ApplicationStatus = Doc<"applications">["status"];

const STATUS_META: Record<ApplicationStatus, { label: string; variant: "info" | "warning" | "success" | "destructive" }> = {
  matched: { label: "Matched", variant: "info" },
  applying: { label: "Applying", variant: "warning" },
  applied: { label: "Applied", variant: "success" },
  interview: { label: "Interview", variant: "info" },
  rejected: { label: "Rejected", variant: "destructive" },
  offered: { label: "Offered", variant: "success" },
};

const STATUS_ORDER: ApplicationStatus[] = [
  "matched",
  "applying",
  "applied",
  "interview",
  "rejected",
  "offered",
];

type Tab = "overview" | "applications" | "profile";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Read a File in the browser and split it into base64 chunks. The chunks are
 * then sent through the normal Convex mutation channel — the same transport as
 * every other request the app makes, so there is no separate upload endpoint,
 * no signed URL and no CORS/proxy hop left to fail.
 */
async function fileToBase64Chunks(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Build the binary string in slices (String.fromCharCode has arg limits).
  let binary = "";
  const SLICE = 0x8000;
  for (let i = 0; i < bytes.length; i += SLICE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + SLICE));
  }
  const b64 = btoa(binary);
  const CHUNK_B64 = 700_000; // chars per mutation (~512 KB of file), divisible by 4
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_B64) {
    chunks.push(b64.slice(i, i + CHUNK_B64));
  }
  return chunks.length > 0 ? chunks : [btoa("")]; // never send zero chunks
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const me = useQuery(api.users.getMe);
  const { signOut } = useAuthActions();

  const navItems: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "applications", label: "Applications", icon: Briefcase },
    { key: "profile", label: "My data", icon: UserRound },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600">
              <Radar className="size-5 text-slate-950" />
            </span>
            <span className="hidden font-display text-lg font-bold sm:block">
              First<span className="text-primary">Step</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground md:flex">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Engine online
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              className="text-muted-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-56 lg:shrink-0">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                  tab === item.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>
          {me?.email && (
            <p className="mt-6 hidden truncate px-3.5 text-xs text-muted-foreground lg:block">
              {me.email}
            </p>
          )}
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {tab === "overview" && <OverviewTab onNavigate={setTab} />}
          {tab === "applications" && <ApplicationsTab />}
          {tab === "profile" && <ProfileTab />}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Briefcase;
  accent: string;
}) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-display text-3xl font-bold">{value}</p>
        </div>
        <span className={cn("flex size-10 items-center justify-center rounded-xl", accent)}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const stats = useQuery(api.applications.stats);
  const notifications = useQuery(api.notifications.list, { limit: 6 });
  const profile = useQuery(api.profiles.getMyProfile);
  const runEngine = useAction(api.engine.runEngine);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const profileReady = Boolean(
    profile && profile.targetRoles?.length && profile.skills?.length,
  );
  const hasResume = Boolean(profile?.resumeStorageId);

  async function handleRunEngine() {
    setRunning(true);
    setResult(null);
    try {
      const res = await runEngine({});
      if (res.ran) {
        setResult({ ok: true, message: res.created > 0
          ? `Done — ${res.created} new jobs processed. Check Applications and your inbox.`
          : "Sweep complete — no new jobs beyond what you already have. Next sweep continues automatically." });
      } else {
        setResult({ ok: false, message: res.reason });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Engine run failed." });
    } finally {
      setRunning(false);
    }
  }

  // Live engine status: the continuous hunt sweeps every hour on its own.
  const lastRunAgoMin = profile?.lastEngineRunAt
    ? Math.max(0, Math.round((Date.now() - profile.lastEngineRunAt) / 60000))
    : null;
  const lastRunText =
    lastRunAgoMin === null
      ? "first sweep hasn't run yet"
      : lastRunAgoMin < 1
        ? "sweeping right now"
        : lastRunAgoMin < 60
          ? `last sweep ${lastRunAgoMin} min ago`
          : `last sweep ${Math.round(lastRunAgoMin / 60)}h ago`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your engine at a glance — applications, interviews, and offers.
          </p>
        </div>
        <Button onClick={() => void handleRunEngine()} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Rocket className="size-4" />}
          {running ? "Engine running…" : "Run engine now"}
        </Button>
      </div>

      {result && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            result.ok
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {result.ok ? <CheckCircle2 className="mr-2 inline size-4" /> : <XCircle className="mr-2 inline size-4" />}
          {result.message}
        </div>
      )}

      {!profileReady && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Settings2 className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Your profile is incomplete</p>
                <p className="text-xs text-muted-foreground">
                  Add target roles and skills so the engine knows what to search for.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => onNavigate("profile")}>
              Complete profile
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total tracked" value={stats.total} icon={Briefcase} accent="bg-primary/15 text-primary" />
          <StatCard label="Applied" value={stats.applied} icon={Rocket} accent="bg-accent/15 text-accent" />
          <StatCard label="Interviews" value={stats.interviews} icon={MailCheck} accent="bg-amber-500/15 text-amber-400" />
          <StatCard label="Offers" value={stats.offers} icon={CheckCircle2} accent="bg-emerald-500/15 text-emerald-400" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engine status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="size-4 text-primary" /> Continuous job hunt
            </CardTitle>
            <CardDescription>The engine sweeps every hour — finding and applying for you.</CardDescription>
          </CardHeader>
          <CardContent className="mb-1">
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
                </span>
                <span className="font-medium">Hunting continuously · {lastRunText}</span>
              </div>
              {typeof profile?.lastRunFound === "number" && (
                <span className="text-xs text-muted-foreground">+{profile.lastRunFound} last sweep</span>
              )}
            </div>
            {(profile?.targetRoles?.length ?? 0) > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Hunting for: <span className="text-foreground">{profile!.targetRoles!.slice(0, 4).join(", ")}</span>
                {profile!.targetRoles!.length > 4 ? ` +${profile!.targetRoles!.length - 4} more` : ""} across 5 job boards
              </p>
            )}
          </CardContent>
          <CardContent className="space-y-3">
            {[
              { done: Boolean(profile?.targetRoles?.length), label: "Target roles set" },
              { done: Boolean(profile?.skills?.length), label: "Skills added" },
              { done: hasResume, label: "Resume uploaded" },
              { done: Boolean(profile?.location), label: "Location set" },
              { done: Boolean(profile?.emailDigestEnabled), label: "Email digests" },
              { done: Boolean(profile?.whatsappEnabled && profile?.phone), label: "WhatsApp alerts" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm">
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                {item.done ? (
                  <CheckCircle2 className="size-4 text-accent" />
                ) : (
                  <span className="size-2 rounded-full bg-border" />
                )}
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              {profile?.autoApplyEnabled
                ? "Auto-apply is ON — every hour the engine applies with your data; email applications carry your resume and replies land in your inbox."
                : "Auto-apply is OFF — run the engine manually from here."}
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-primary" /> Notifications
            </CardTitle>
            {stats && stats.unreadNotifications > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                Mark all read
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!notifications || notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No notifications yet — run the engine to see activity here.
              </p>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li
                    key={n._id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3.5 py-2.5",
                      n.read ? "border-border bg-card" : "border-primary/30 bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        n.read ? "bg-border" : "bg-primary shadow-[0_0_8px_2px_rgba(34,211,238,0.5)]",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDate(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ApplicationsTab() {
  const applications = useQuery(api.applications.list, {});
  const updateStatus = useMutation(api.applications.updateStatus);
  const generateResume = useMutation(api.resumeGen.generateResume);
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [resumeAppId, setResumeAppId] = useState<Id<"applications"> | null>(null);
  const [generatingId, setGeneratingId] = useState<Id<"applications"> | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const viewApp = resumeAppId ? applications?.find((a) => a._id === resumeAppId) ?? null : null;

  async function handleGenerateResume(id: Id<"applications">) {
    setGeneratingId(id);
    setGenError(null);
    try {
      await generateResume({ applicationId: id });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Could not generate the resume.");
    } finally {
      setGeneratingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!applications) return [];
    if (filter === "all") return applications;
    return applications.filter((a) => a.status === filter);
  }, [applications, filter]);

  if (!applications) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading applications…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything the engine found and submitted for you.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === s
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "all" ? "All" : STATUS_META[s].label}
            <span className="ml-1.5 opacity-60">
              {s === "all" ? applications.length : applications.filter((a) => a.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Briefcase className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "No applications yet. Run the engine from Overview to find your first matches."
                : "Nothing in this bucket yet."}
            </p>
            {filter === "all" && (
              <p className="text-xs text-muted-foreground/70">
                Tip: complete your profile first — the engine needs target roles and skills.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((app) => (
            <li key={app._id}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{app.jobTitle}</p>
                      <Badge variant={STATUS_META[app.status].variant}>
                        {STATUS_META[app.status].label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {app.company} · {app.location}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {app.employmentType && (
                        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                          {app.employmentType}
                        </span>
                      )}
                      {app.seniority && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                          {app.seniority} level
                        </span>
                      )}
                      {app.sponsorship === true && (
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-400">
                          Visa sponsorship mentioned
                        </span>
                      )}
                      {app.board && (
                        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                          via {app.board}
                        </span>
                      )}
                      {typeof app.postedAt === "number" && (
                        <span className="text-[11px] text-muted-foreground/70">
                          posted {formatDate(app.postedAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {formatDate(app.createdAt)}
                      {app.appliedAt ? ` · applied ${formatDate(app.appliedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.status === "applying" && app.sourceUrl && (
                      <Button size="sm" asChild>
                        <a href={app.sourceUrl} target="_blank" rel="noreferrer">
                          Submit now <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                    {app.sourceUrl && app.status !== "applying" && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={app.sourceUrl} target="_blank" rel="noreferrer">
                          Visit <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setResumeAppId(app._id)}>
                      <FileText className="size-3.5" />
                      Resume
                    </Button>
                    <select
                      value={app.status}
                      onChange={(e) =>
                        void updateStatus({ id: app._id, status: e.target.value as ApplicationStatus })
                      }
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {viewApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setResumeAppId(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-primary" /> Tailored resume
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {viewApp.jobTitle} · {viewApp.company}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setResumeAppId(null)}>
                Close
              </Button>
            </div>
            <div className="max-h-[60vh] flex-1 overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-foreground/90">
              {viewApp.generatedResume ?? "No tailored resume for this job yet — generate one from your profile."}
            </div>
            {!viewApp.generatedResume && (
              <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
                <Button
                  size="sm"
                  disabled={generatingId !== null}
                  onClick={() => void handleGenerateResume(viewApp._id)}
                >
                  {generatingId === viewApp._id ? <Loader2 className="animate-spin" /> : null}
                  {generatingId === viewApp._id ? "Generating…" : "Generate tailored resume"}
                </Button>
                {genError && <p className="text-xs text-destructive">{genError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab() {
  const profile = useQuery(api.profiles.getMyProfile);
  const me = useQuery(api.users.getMe);
  const resumeUrl = useQuery(api.profiles.getResumeUrl);
  // The backend returns a 127.0.0.1 storage URL — rewrite it to the origin the
  // browser can reach so the "View uploaded resume" link actually opens.
  const resumeLink = resumeUrl ? rewriteConvexUrl(resumeUrl) : null;
  const upsertProfile = useMutation(api.profiles.upsertProfile);
  const setResume = useMutation(api.profiles.setResume);
  const beginUpload = useMutation(api.uploads.beginChunkedUpload);
  const pushChunk = useMutation(api.uploads.pushUploadChunk);
  const finalizeUpload = useAction(api.uploads.finalizeChunkedUpload);
  const scanResume = useAction(api.resume.parseResume);

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [skillsInput, setSkillsInput] = useState("");
  const [rolesInput, setRolesInput] = useState("");
  const [educationInput, setEducationInput] = useState("");
  const [autoApply, setAutoApply] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setHeadline(profile.headline ?? "");
    setLocation(profile.location ?? "");
    setRemote(profile.remote ?? false);
    setSkillsInput((profile.skills ?? []).join(", "));
    setRolesInput((profile.targetRoles ?? []).join(", "));
    setEducationInput((profile.education ?? []).join("\n"));
    setAutoApply(profile.autoApplyEnabled ?? true);
    setEmailDigest(profile.emailDigestEnabled ?? true);
    setPhone(profile.phone ?? "");
    setWhatsapp(profile.whatsappEnabled ?? true);
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const targetRoles = rolesInput.split(",").map((s) => s.trim()).filter(Boolean);
    await upsertProfile({
      fullName: fullName.trim() || undefined,
      headline: headline.trim() || undefined,
      location: location.trim() || undefined,
      remote,
      skills: skills.length ? skills : undefined,
      targetRoles: targetRoles.length ? targetRoles : undefined,
      education: educationInput.split("\n").map((s) => s.trim()).filter(Boolean).length
        ? educationInput.split("\n").map((s) => s.trim()).filter(Boolean)
        : undefined,
      autoApplyEnabled: autoApply,
      emailDigestEnabled: emailDigest,
      phone: phone.trim() || undefined,
      whatsappEnabled: whatsapp,
    });
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function handleFileSelect(file: File | null | undefined) {
    if (!file) return;
    void uploadFile(file);
  }

  async function uploadFile(file: File) {
    if (file.size === 0) {
      setFileName(file.name);
      setUploadError("That file is empty — please pick your actual resume file.");
      setUploading(false);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFileName(file.name);
      setUploadError("File is larger than 20 MB — please upload a smaller version.");
      setUploading(false);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setScanResult(null);
    setFileName(file.name);
    // Fails fast with a named step instead of spinning forever if the
    // connection to the backend drops.
    const step = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<never>((_, rej) =>
          window.setTimeout(
            () => rej(new Error(`${label} timed out — connection to the server was lost. Refresh the page and try again.`)),
            ms,
          ),
        ),
      ]);
    try {
      // Step 1: read + chunk the file locally in the browser
      const chunks = await fileToBase64Chunks(file);
      setUploadProgress(0.05);
      // Step 2: open an upload session on the backend
      const sessionId = await step(
        beginUpload({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          totalChunks: chunks.length,
        }),
        30000,
        "Opening upload",
      );
      // Step 3: push every chunk through the normal request channel — each
      // chunk is retried once automatically in case of a network blip.
      for (let i = 0; i < chunks.length; i++) {
        const send = () =>
          step(pushChunk({ sessionId, index: i, data: chunks[i] }), 45000, `Sending part ${i + 1}/${chunks.length}`);
        try {
          await send();
        } catch {
          await send();
        }
        setUploadProgress(0.05 + (0.85 * (i + 1)) / chunks.length);
      }
      // Step 4: backend reassembles the file and stores it
      const result = await step(finalizeUpload({ sessionId }), 90000, "Finalizing upload");
      const storageId = String(result.storageId);
      setUploadProgress(1);
      // Step 5: save the reference to the user's profile
      await step(setResume({ storageId: storageId as Id<"_storage">, fileName: file.name }), 30000, "Saving to your profile");
      setUploading(false);
      setUploadProgress(null);

      // Step 4: scan the resume to auto-fill profile fields
      setScanning(true);
      try {
        const parsed = await scanResume({ storageId: storageId as Id<"_storage"> });
        if (!parsed || !parsed.ok) {
          setScanResult({
            ok: false,
            message: `Uploaded successfully, but we couldn't read text from this file${parsed?.reason ? ` — ${parsed.reason}` : ""}. Fill the form manually and hit Save.`,
          });
        } else {
          const filled: string[] = [];
          if (parsed.name && !fullName.trim()) {
            setFullName(parsed.name);
            filled.push("name");
          }
          if (parsed.phone && !phone.trim()) {
            setPhone(parsed.phone);
            filled.push("phone");
          }
          if (parsed.location && !location.trim()) {
            setLocation(parsed.location);
            filled.push("location");
          }
          const skills = parsed.skills ?? [];
          const roles = parsed.targetRoles ?? [];
          const suggested = parsed.suggestedRoles ?? [];
          if (skills.length > 0 && !skillsInput.trim()) {
            setSkillsInput(skills.join(", "));
            filled.push("skills");
          }
          if (roles.length > 0 && !rolesInput.trim()) {
            setRolesInput(roles.join(", "));
            filled.push("target roles");
          } else if (roles.length === 0 && suggested.length > 0 && !rolesInput.trim()) {
            // Resume didn't name a role, but its skills clearly point at some —
            // prefill those so the student starts with sensible targets.
            setRolesInput(suggested.slice(0, 6).join(", "));
            filled.push("suggested roles");
          }
          const education = parsed.education ?? [];
          if (education.length > 0 && !educationInput.trim()) {
            setEducationInput(education.join("\n"));
            filled.push("education");
          }
          const extraNote = suggested.length
            ? ` The engine will also consider ${suggested.length} related fresher roles (${suggested.slice(0, 3).join(", ")}${suggested.length > 3 ? "…" : ""}) so you get hired faster.`
            : "";
          setScanResult(
            filled.length > 0
              ? { ok: true, message: `Resume scanned — auto-filled ${filled.join(", ")}.${extraNote} Review below and hit Save.` }
              : { ok: true, message: `Resume scanned — no new fields to fill.${extraNote}` },
          );
        }
      } catch {
        setScanResult({ ok: false, message: "Uploaded successfully, but the scan hit an error. Fill the form manually and hit Save." });
      } finally {
        setScanning(false);
      }
    } catch (err) {
      setUploading(false);
      setUploadProgress(null);
      setUploadError(
        err instanceof Error ? err.message : "Could not upload your file. Try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">My data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything the engine needs to find, apply, and build your resume for each job.
          Fill it once — upload your resume and it auto-fills most of it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" /> About you
            </CardTitle>
            <CardDescription>Tell the engine who you are.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Priya Sharma" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="BSc Computer Science graduate" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (used on applications)</Label>
              <Input id="email" value={me?.email ?? ""} readOnly className="bg-muted/50 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Your sign-in address — recruiters and interview invites go here.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru, India" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={remote}
                  onChange={(e) => setRemote(e.target.checked)}
                  className="size-4 rounded border-input accent-cyan-500"
                />
                Open to remote work
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15551234567"
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">
                E.164 format with country code — used for WhatsApp digests.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="targetRoles">Target roles</Label>
              <Input id="targetRoles" value={rolesInput} onChange={(e) => setRolesInput(e.target.value)} placeholder="Software Engineer, Data Analyst" />
              <p className="text-xs text-muted-foreground">Comma-separated. The engine searches for these.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="skills">Skills</Label>
              <Textarea id="skills" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Python, SQL, Communication, Excel" rows={2} />
              <p className="text-xs text-muted-foreground">Comma-separated. Used to score how well each job matches you.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" /> Education
            </CardTitle>
            <CardDescription>
              Your degrees and coursework — the engine includes these in every tailored resume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="education"
              value={educationInput}
              onChange={(e) => setEducationInput(e.target.value)}
              placeholder={"BSc Computer Science — Pune University\nHigher Secondary (12th) — Science"}
              rows={3}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              One entry per line. Auto-filled when your resume mentions it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Resume
            </CardTitle>
            <CardDescription>
              Upload your source resume — the engine scans it to learn about you, then
              builds a tailored resume for every job it applies to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploading ? (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    <span className="truncate">{fileName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {uploadProgress === null ? "Uploading…" : `${Math.round(uploadProgress * 100)}%`}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.round((uploadProgress ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            ) : profile?.resumeStorageId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{profile.resumeFileName ?? "Resume uploaded"}</p>
                    <p className="text-xs text-muted-foreground">Saved — the engine uses this for every application.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {resumeLink && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={resumeLink} target="_blank" rel="noreferrer">
                        View <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        handleFileSelect(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm transition-colors hover:bg-muted">
                      Replace
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelect(e.dataTransfer.files?.[0]);
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    handleFileSelect(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <UploadCloud className="size-5" />
                </span>
                <span className="text-sm font-medium">Click to upload or drag & drop</span>
                <span className="max-w-xs text-xs text-muted-foreground">
                  PDF, DOCX or TXT — the engine scans it and auto-fills your details.
                </span>
              </label>
            )}

            {uploadError && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <XCircle className="mt-0.5 size-3.5 shrink-0" /> {uploadError}
              </p>
            )}
            {scanning && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Scanning resume for your details…
              </p>
            )}
            {!scanning && scanResult && (
              <p
                className={cn(
                  "flex items-start gap-1.5 rounded-md border px-3 py-2 text-xs",
                  scanResult.ok
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                )}
              >
                {scanResult.ok ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                )}
                {scanResult.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" /> Engine settings
            </CardTitle>
            <CardDescription>How aggressive should the engine be?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <span>
                <span className="block text-sm font-medium">Auto-apply (daily cron)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  The engine searches and applies every 24 hours without you lifting a finger.
                </span>
              </span>
              <input
                type="checkbox"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-cyan-500"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <span>
                <span className="block text-sm font-medium">Email digests</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Get an email every time applications are submitted or an offer comes in.
                </span>
              </span>
              <input
                type="checkbox"
                checked={emailDigest}
                onChange={(e) => setEmailDigest(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-cyan-500"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <span>
                <span className="block text-sm font-medium">WhatsApp digests</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Get instant updates on WhatsApp when the engine matches or applies to jobs.
                </span>
              </span>
              <input
                type="checkbox"
                checked={whatsapp}
                onChange={(e) => setWhatsapp(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-cyan-500"
              />
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save profile"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-accent">
              <CheckCircle2 className="size-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
