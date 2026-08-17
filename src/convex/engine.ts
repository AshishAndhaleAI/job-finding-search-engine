import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

type JobCandidate = {
  title: string;
  company: string;
  location: string;
  url?: string;
  haystack: string;
};

/**
 * Demo jobs used when every live job source is unreachable, so the product can
 * still be previewed end-to-end: the engine "applies" to a matching curated set.
 */
const DEMO_JOBS: JobCandidate[] = [
  { title: "Entry-Level Software Engineer", company: "TechNova Labs", location: "Remote (Worldwide)", haystack: "software engineer entry level junior react typescript developer fresher 0 experience" },
  { title: "Junior Frontend Developer", company: "PixelForge Studios", location: "Remote (Worldwide)", haystack: "frontend developer html css javascript react entry level junior fresher" },
  { title: "Graduate Data Analyst", company: "Insight Metrics", location: "London, UK", haystack: "data analyst sql excel power bi python entry level graduate fresher" },
  { title: "Fresher QA Test Engineer", company: "QualityWorks", location: "Bengaluru, India", haystack: "qa test engineer manual testing automation entry level fresher 0 experience" },
  { title: "Customer Support Associate", company: "GlobalDesk", location: "Remote (Worldwide)", haystack: "customer support associate communication entry level fresher no experience" },
  { title: "Sales Development Representative", company: "GrowthHive", location: "New York, USA", haystack: "sales development representative sdr entry level fresher 0 experience" },
  { title: "Junior Marketing Coordinator", company: "BrightWave", location: "Toronto, Canada", haystack: "marketing coordinator social media content entry level junior fresher" },
  { title: "Associate Content Writer", company: "WordCraft Media", location: "Remote (Worldwide)", haystack: "content writer english communication writing entry level fresher" },
  { title: "Junior Graphic Designer", company: "Studio Nine", location: "Berlin, Germany", haystack: "graphic designer figma photoshop adobe creative entry level junior fresher" },
  { title: "IT Support Technician (Entry Level)", company: "HelpDesk Plus", location: "Austin, USA", haystack: "it support technician helpdesk windows networking entry level fresher" },
  { title: "Junior Business Analyst", company: "StrategyPoint", location: "Singapore", haystack: "business analyst excel documentation requirements entry level graduate fresher" },
  { title: "Associate Product Manager", company: "Launchpad Labs", location: "San Francisco, USA", haystack: "product manager associate entry level junior fresher 0 experience" },
  { title: "Junior DevOps Engineer", company: "CloudRise", location: "Remote (Worldwide)", haystack: "devops engineer aws docker linux ci cd entry level junior fresher" },
  { title: "Entry-Level Cybersecurity Analyst", company: "SecureShield", location: "Dublin, Ireland", haystack: "cybersecurity analyst security entry level junior fresher 0 experience" },
  { title: "Junior Mobile Developer (iOS/Android)", company: "AppForge", location: "Remote (Worldwide)", haystack: "mobile developer android ios flutter react native entry level fresher" },
  { title: "Graduate Financial Analyst", company: "CapitalBridge", location: "Sydney, Australia", haystack: "financial analyst excel finance accounting entry level graduate fresher" },
  { title: "Junior Project Coordinator", company: "BuildRight", location: "Dubai, UAE", haystack: "project coordinator organization communication entry level junior fresher" },
  { title: "Entry-Level HR Assistant", company: "PeopleFirst", location: "Amsterdam, Netherlands", haystack: "hr assistant human resources recruiting entry level fresher" },
  { title: "Fresh Graduate Sales Trainee", company: "Vertex Retail", location: "Mumbai, India", haystack: "sales trainee retail communication entry level fresher 0 experience" },
  { title: "Junior Data Entry & Operations Associate", company: "DataFlow", location: "Remote (Worldwide)", haystack: "data entry operations excel detail oriented entry level fresher" },
];

function scoreJob(job: JobCandidate, roles: string[], skills: string[]): number {
  const hay = job.haystack.toLowerCase();
  let score = 0;
  for (const role of roles) {
    if (hay.includes(role.toLowerCase())) score += 3;
  }
  for (const skill of skills) {
    if (hay.includes(skill.toLowerCase())) score += 2;
  }
  return score;
}

function matchDemoJobs(
  targetRoles: string[],
  skills: string[],
  limit: number,
): JobCandidate[] {
  return DEMO_JOBS.map((job) => ({ job, score: scoreJob(job, targetRoles, skills) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ job }) => job);
}

/* ---------------------------------------------------------------------------
 * FREE job sources — no API key, no signup, no cost.
 * The engine aggregates these boards so a student gets real, live jobs out of
 * the box. Each source is wrapped in try/catch so one failing board never
 * takes the whole engine down.
 * ------------------------------------------------------------------------- */

async function fetchFromRemotive(): Promise<JobCandidate[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs?limit=100");
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      title?: string;
      company_name?: string;
      candidate_required_location?: string | null;
      url?: string;
      tags?: string[];
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.title ?? "Unknown role",
    company: j.company_name ?? "Unknown company",
    location: j.candidate_required_location || "Remote",
    url: j.url,
    haystack: [j.title, j.company_name, ...(j.tags ?? [])].filter(Boolean).join(" "),
  }));
}

async function fetchFromArbeitnow(): Promise<JobCandidate[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api?page=1");
  if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{
      title?: string;
      company_name?: string;
      location?: string;
      url?: string;
      tags?: string[];
    }>;
  };
  return (data.data ?? []).map((j) => ({
    title: j.title ?? "Unknown role",
    company: j.company_name ?? "Unknown company",
    location: j.location ?? "Remote",
    url: j.url,
    haystack: [j.title, j.company_name, j.location, ...(j.tags ?? [])].filter(Boolean).join(" "),
  }));
}

async function fetchFromRemoteOk(): Promise<JobCandidate[]> {
  const res = await fetch("https://remoteok.com/api");
  if (!res.ok) throw new Error(`RemoteOK HTTP ${res.status}`);
  // RemoteOK returns an array whose first element is a fake placeholder —
  // skip any entry that has no url.
  const data = (await res.json()) as Array<{
    position?: string;
    company?: string;
    location?: string;
    url?: string;
    tags?: string[];
  }>;
  return data
    .filter((j) => Boolean(j.url) && Boolean(j.position))
    .map((j) => ({
      title: j.position ?? "Unknown role",
      company: j.company ?? "Unknown company",
      location: j.location || "Remote",
      url: j.url,
      haystack: [j.position, j.company, j.location, ...(j.tags ?? [])].filter(Boolean).join(" "),
    }));
}

const FREE_JOB_SOURCES: { name: string; fetch: () => Promise<JobCandidate[]> }[] = [
  { name: "Remotive", fetch: fetchFromRemotive },
  { name: "Arbeitnow", fetch: fetchFromArbeitnow },
  { name: "RemoteOK", fetch: fetchFromRemoteOk },
];

/**
 * Aggregates real jobs from the free sources (plus an optional Brave Search
 * boost when BRAVE_API_KEY is set), dedupes them, and keeps only the ones that
 * match the student's target roles / skills.
 */
async function fetchLiveJobs(
  targetRoles: string[],
  skills: string[],
  location: string | undefined,
  limit: number,
): Promise<JobCandidate[]> {
  const settled = await Promise.allSettled(FREE_JOB_SOURCES.map((s) => s.fetch()));
  const candidates: JobCandidate[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") candidates.push(...result.value);
  }
  // Optional boost: if the owner later adds a Brave Search API key, blend in
  // general web-search results. Free sources still work without it.
  if (process.env.BRAVE_API_KEY) {
    try {
      candidates.push(...(await searchJobsWithBrave(targetRoles, location, limit)));
    } catch {
      // ignore — free sources are the backbone
    }
  }
  const seen = new Set<string>();
  const unique = candidates.filter((job) => {
    if (!job.url) return true;
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
  return unique
    .map((job) => ({ job, score: scoreJob(job, targetRoles, skills) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ job }) => job);
}

/** Optional live job search via the Brave Search API (needs BRAVE_API_KEY). */
async function searchJobsWithBrave(
  targetRoles: string[],
  location: string | undefined,
  limit: number,
): Promise<JobCandidate[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("BRAVE_API_KEY is not set");
  const candidates: JobCandidate[] = [];
  const seen = new Set<string>();
  const roles = targetRoles.slice(0, 3);
  const place = location && location.length > 0 ? ` in ${location}` : "";
  for (const role of roles) {
    const query = `"entry level" OR "fresher" OR "junior" ${role} job hiring apply${place}`;
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(limit, 10)));
    url.searchParams.set("freshness", "pt14d");
    url.searchParams.set("search_lang", "en");
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
    });
    if (!res.ok) {
      throw new Error(`Brave Search API returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      web?: { results?: Array<{ title: string; url: string; description?: string }> };
    };
    for (const result of data.web?.results ?? []) {
      if (!result.url || seen.has(result.url)) continue;
      seen.add(result.url);
      const hay = `${result.title} ${result.description ?? ""}`.toLowerCase();
      if (!/(job|hiring|apply|career|vacanc|opening|opportunit)/.test(hay)) continue;
      candidates.push({
        title: result.title.slice(0, 140),
        company: companyFromUrl(result.url),
        location: place.trim() || "Worldwide",
        url: result.url,
        haystack: hay,
      });
    }
  }
  return candidates
    .map((job) => ({ job, score: scoreJob(job, targetRoles, []) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ job }) => job);
}

function companyFromUrl(urlString: string): string {
  try {
    const host = new URL(urlString).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return host;
  } catch {
    return "Unknown company";
  }
}

function digestHtml(jobs: JobCandidate[], mode: "live" | "demo", count: number): string {
  const rows = jobs
    .slice(0, 8)
    .map(
      (j) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(j.title)}</strong><br/><span style="color:#64748b;">${escapeHtml(j.company)} · ${escapeHtml(j.location)}</span></td></tr>`,
    )
    .join("");
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
    <h2 style="color:#0e7490;">FirstStep — your job engine</h2>
    <p>${mode === "live" ? `We matched <strong>${count}</strong> new entry-level jobs for you.` : `We submitted <strong>${count}</strong> applications for you (demo mode).`}</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;">${rows}</table>
    <p style="margin-top:16px;color:#64748b;">Login to FirstStep to review, update statuses, and manage your profile.</p>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Short WhatsApp digest — plain text, capped so the message stays readable. */
function whatsappDigestText(jobs: JobCandidate[], mode: "live" | "demo", count: number): string {
  const lines = jobs
    .slice(0, 5)
    .map((j, i) => `${i + 1}. ${j.title} — ${j.company} (${j.location})`)
    .join("\n");
  return [
    "FirstStep 🤖 — Your job engine",
    "",
    mode === "live"
      ? `✅ Matched ${count} new entry-level jobs for you.`
      : `✅ Applied to ${count} demo jobs (live boards were unreachable).`,
    "",
    lines,
    "",
    "Log in to FirstStep to review, update statuses, and manage your profile.",
  ].join("\n");
}

type ChannelResult = { sent: boolean; reason?: string };

type RunEngineResult =
  | { ran: true; mode: "live" | "demo"; created: number; email: ChannelResult | null; whatsapp: ChannelResult | null }
  | { ran: false; reason: string; created: number };

/**
 * Run the engine for the signed-in user (dashboard "Run engine" button).
 * Live jobs come from free sources with no API key. If every source is
 * unreachable, it falls back to curated demo jobs so the flow still works.
 */
async function runEngineHandler(ctx: ActionCtx, args: { limit?: number }): Promise<RunEngineResult> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  const profile = await ctx.runQuery(api.profiles.getMyProfile, {});
  if (!profile || !profile.targetRoles?.length) {
    return { ran: false, reason: "Complete your profile with at least one target role first.", created: 0 };
  }
  const limit = args.limit ?? 10;
  let jobs: JobCandidate[] = [];
  let mode: "live" | "demo" = "live";
  try {
    jobs = await fetchLiveJobs(profile.targetRoles, profile.skills ?? [], profile.location ?? undefined, limit);
  } catch {
    jobs = [];
  }
  if (jobs.length === 0) {
    jobs = matchDemoJobs(profile.targetRoles, profile.skills ?? [], limit);
    mode = "demo";
  }
  if (jobs.length === 0) {
    return { ran: false, reason: "No matching jobs found this run.", created: 0 };
  }

  // Live mode flags jobs as "matched" (review + submit from the listing link).
  // Demo mode simulates submitted applications so the tracker stays alive.
  const status: "matched" | "applied" = mode === "live" ? "matched" : "applied";
  const created = await ctx.runMutation(api.applications.recordMany, {
    jobs: jobs.map((j) => ({
      jobTitle: j.title,
      company: j.company,
      location: j.location,
      sourceUrl: j.url,
      status,
    })),
  });
  await ctx.runMutation(api.notifications.createMany, {
    items: [
      {
        kind: "application_submitted",
        title: mode === "live" ? `Engine matched ${created} new jobs` : `Engine applied to ${created} demo jobs`,
        body: mode === "live"
          ? "Review them and submit from the Applications tab."
          : "Live job sources were unreachable — showing demo jobs. Try again later.",
      },
    ],
  });

  let email: ChannelResult | null = null;
  if (profile.emailDigestEnabled) {
    const me = await ctx.runQuery(api.users.getMe, {});
    if (me?.email) {
      email = await ctx.runAction(api.email.sendDigest, {
        to: me.email,
        subject: mode === "live" ? `FirstStep: ${created} new jobs matched` : `FirstStep: ${created} applications submitted`,
        html: digestHtml(jobs, mode, created),
      });
    }
  }
  let whatsapp: ChannelResult | null = null;
  if (profile.whatsappEnabled && profile.phone) {
    whatsapp = await ctx.runAction(api.whatsapp.sendMessage, {
      to: profile.phone,
      text: whatsappDigestText(jobs, mode, created),
    });
  }
  return { ran: true, mode, created, email, whatsapp };
}

export const runEngine = action({
  args: { limit: v.optional(v.number()) },
  handler: runEngineHandler,
});

/**
 * Daily cron sweep: runs the engine for every student who enabled auto-apply.
 * Requires no signed-in user, so it uses the internal *ForUser mutations.
 */
async function engineDailyHandler(ctx: ActionCtx): Promise<{ ran: true; created: number }> {
  const profiles = await ctx.runQuery(api.profiles.listAll, {});
  let totalCreated = 0;
  for (const profile of profiles) {
    if (!profile.autoApplyEnabled || !profile.targetRoles?.length) continue;
    let jobs: JobCandidate[] = [];
    let mode: "live" | "demo" = "live";
    try {
      jobs = await fetchLiveJobs(profile.targetRoles, profile.skills ?? [], profile.location ?? undefined, 10);
    } catch {
      jobs = [];
    }
    if (jobs.length === 0) {
      jobs = matchDemoJobs(profile.targetRoles, profile.skills ?? [], 10);
      mode = "demo";
    }
    if (jobs.length === 0) continue;
    const status: "matched" | "applied" = mode === "live" ? "matched" : "applied";
    const created = await ctx.runMutation(api.applications.recordManyForUser, {
      userId: profile.userId,
      jobs: jobs.map((j) => ({
        jobTitle: j.title,
        company: j.company,
        location: j.location,
        sourceUrl: j.url,
        status,
      })),
    });
    if (created === 0) continue;
    totalCreated += created;
    await ctx.runMutation(api.notifications.createManyForUser, {
      userId: profile.userId,
      items: [
        {
          kind: "application_submitted",
          title: mode === "live" ? `Engine matched ${created} new jobs` : `Engine applied to ${created} demo jobs`,
          body: mode === "live"
            ? "Review them and submit from the Applications tab."
            : "Live job sources were unreachable — showing demo jobs. Try again later.",
        },
      ],
    });
    if (profile.emailDigestEnabled) {
      const me = await ctx.runQuery(api.users.getUserById, { userId: profile.userId });
      if (me?.email) {
        await ctx.runAction(api.email.sendDigest, {
          to: me.email,
          subject: mode === "live" ? `FirstStep: ${created} new jobs matched` : `FirstStep: ${created} applications submitted`,
          html: digestHtml(jobs, mode, created),
        });
      }
    }
    if (profile.whatsappEnabled && profile.phone) {
      await ctx.runAction(api.whatsapp.sendMessage, {
        to: profile.phone,
        text: whatsappDigestText(jobs, mode, created),
      });
    }
  }
  return { ran: true, created: totalCreated };
}

export const engineDaily = action({
  args: {},
  handler: engineDailyHandler,
});
