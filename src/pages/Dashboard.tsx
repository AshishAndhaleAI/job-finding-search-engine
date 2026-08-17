import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  BellRing,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  MailCheck,
  Radar,
  Rocket,
  Settings2,
  UserRound,
  XCircle,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";

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

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const me = useQuery(api.users.getMe);
  const { signOut } = useAuthActions();

  const navItems: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "applications", label: "Applications", icon: Briefcase },
    { key: "profile", label: "Profile & Resume", icon: UserRound },
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
        setResult({
          ok: true,
          message:
            res.mode === "live"
              ? `Engine matched ${res.created} new jobs. Review them in Applications.`
              : `Engine applied to ${res.created} demo jobs. The free job boards were unreachable — try again later.`,
        });
      } else {
        setResult({ ok: false, message: res.reason });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Engine run failed." });
    } finally {
      setRunning(false);
    }
  }

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
              <Radar className="size-4 text-primary" /> Engine status
            </CardTitle>
            <CardDescription>What the engine needs to start applying.</CardDescription>
          </CardHeader>
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
                ? "Auto-apply is ON — the engine runs daily and applies for you."
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
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");

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
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {formatDate(app.createdAt)}
                      {app.appliedAt ? ` · applied ${formatDate(app.appliedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.sourceUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={app.sourceUrl} target="_blank" rel="noreferrer">
                          Visit <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
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
    </div>
  );
}

function ProfileTab() {
  const profile = useQuery(api.profiles.getMyProfile);
  const resumeUrl = useQuery(api.profiles.getResumeUrl);
  const upsertProfile = useMutation(api.profiles.upsertProfile);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const setResume = useMutation(api.profiles.setResume);

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [skillsInput, setSkillsInput] = useState("");
  const [rolesInput, setRolesInput] = useState("");
  const [autoApply, setAutoApply] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setHeadline(profile.headline ?? "");
    setLocation(profile.location ?? "");
    setRemote(profile.remote ?? false);
    setSkillsInput((profile.skills ?? []).join(", "));
    setRolesInput((profile.targetRoles ?? []).join(", "));
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
      autoApplyEnabled: autoApply,
      emailDigestEnabled: emailDigest,
      phone: phone.trim() || undefined,
      whatsappEnabled: whatsapp,
    });
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setResume({ storageId });
    } catch {
      setUploadError("Could not upload your resume. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Profile & Resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is everything the engine uses to search and apply for you.
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
              <FileText className="size-4 text-primary" /> Resume
            </CardTitle>
            <CardDescription>The engine attaches this to every application it submits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer">
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => void handleResumeUpload(e)} />
                <span className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-4 text-sm shadow-sm transition-colors hover:bg-muted">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  {uploading ? "Uploading…" : "Upload resume"}
                </span>
              </label>
              {resumeUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={resumeUrl} target="_blank" rel="noreferrer">
                    View uploaded resume <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              )}
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            </div>
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
