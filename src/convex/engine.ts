import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { rolesFromSkills } from "./roleMap";
import { buildTailoredResume } from "./resumeGen";
import { buildTextPdf, bytesToBase64 } from "./pdf";

type JobCandidate = {
  title: string;
  company: string;
  location: string;
  url?: string;
  haystack: string;
  source?: string;
  employmentType?: string; // "Full-time" | "Internship" | "Contract" | "Part-time"
  postedAt?: number; // epoch ms when the employer posted it
  tags?: string[];
  description?: string; // posting text (used to find application emails)
};

/* ---------------------------------------------------------------------------
 * FRESHER-LEVEL FILTER — the engine only keeps jobs a 0-experience student can
 * realistically get. Senior/lead/management titles and postings demanding
 * years of experience are rejected outright.
 * ------------------------------------------------------------------------- */

const SENIOR_TITLE_BLOCK: RegExp[] = [
  /\bsenior\b/i,
  /\bsr\.?\b/i,
  /\bleads?\b/i,
  /\bleader\b/i,
  /\bleadership\b/i,
  /\bprincipal\b/i,
  /\bprinciple\b/i, // common misspelling used in postings
  /\bstaff\b/i,
  /\bhead of\b/i,
  /\bdirector\b/i,
  /\bvp\b/i,
  /\bchief\b/i,
  /\barchitect\b/i,
  /\bmanager\b/i,
  /\bsupervisor\b/i,
  /\bexperienced\b/i,
  /\bexpert\b/i,
  /\bintermediate\b/i,
  /\bmid[- ]level\b/i,
];

const FRESH_SIGNALS: RegExp[] = [
  /entry[- ]level/i,
  /\bjunior\b/i,
  /\bfresher\b/i,
  /\bgraduate\b/i,
  /\btrainee\b/i,
  /\bintern(ship)?\b/i,
  /\bno experience\b/i,
  /\b0[- ]?experience\b/i,
  /\bearly career\b/i,
  /\bstudent\b/i,
  /\bcampus\b/i,
  /\bapprentice\b/i,
];

/** Vague aggregator posts that aren't real, specific openings. */const JUNK_TITLE_BLOCK: RegExp[] = [
  /^open positions?$/i,
  /^multiple (positions|roles|openings)$/i,
  /^various /i,
  /^job (alert|offer)/i,
  /^apply now/i,
  /^we are hiring$/i,
  /^hiring (now|for)$/i,
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** True when a posting is appropriate for a 0-experience applicant. */
function isFresherFriendly(job: JobCandidate): boolean {
  const title = job.title;
  if (SENIOR_TITLE_BLOCK.some((re) => re.test(title))) return false;
  if (JUNK_TITLE_BLOCK.some((re) => re.test(title.trim()))) return false;
  // Reject postings demanding 3+ years of experience anywhere in the text.
  const m = `${title} ${job.haystack}`.match(/(\d+)\s*\+?\s*(?:years|yrs)\b/i);
  if (m && parseInt(m[1], 10) >= 3) return false;
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreJob(job: JobCandidate, roles: string[], skills: string[]): number {
  const hay = job.haystack.toLowerCase();
  const title = job.title.toLowerCase();
  let score = 0;
  let roleHit = false;
  for (const role of roles) {
    // Word-boundary match so "software engineer" does NOT match inside
    // "senior software engineer" (that title is rejected separately anyway).
    const re = new RegExp(`\\b${escapeRegExp(role.toLowerCase())}\\b`);
    if (re.test(hay)) {
      score += 3;
      roleHit = true;
      // A role match in the actual JOB TITLE is far more relevant than one
      // buried in tags/description — rank those first.
      if (re.test(title)) score += 3;
    }
  }
  for (const skill of skills) {
    if (skill && hay.includes(skill.toLowerCase())) score += 2;
  }
  if (FRESH_SIGNALS.some((re) => re.test(`${job.title} ${job.haystack}`))) score += 2;
  // Only jobs whose ROLE matched count — a skill-only match is not enough.
  return roleHit ? score : 0;
}

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

/**
 * Generic fresher roles that hire fast and in volume — used to top up the
 * search list so a student with few/any target roles still gets applications
 * going immediately.
 */
const FAST_STARTER_ROLES = [
  "graduate trainee",
  "management trainee",
  "entry level engineer",
  "fresher",
  "operations associate",
  "customer support",
  "data entry",
  "project coordinator",
];

/**
 * Build the full role list the engine searches for:
 *   1. the student's own target roles (their intent comes first), then
 *   2. entry-level roles derived from their resume skills, then
 *   3. fast-hiring generic fresher roles to fill remaining slots.
 * Result: the engine applies to ANY role where this student can realistically
 * get hired fastest, not just the titles they happened to type.
 */
function expandRoles(profile: {
  targetRoles?: string[];
  skills?: string[];
}): string[] {
  const out: string[] = [];
  const push = (r: string) => {
    const key = r.toLowerCase().trim();
    if (key && !out.includes(key)) out.push(key);
  };
  for (const r of profile.targetRoles ?? []) push(r);
  for (const r of rolesFromSkills(profile.skills ?? [])) push(r);
  for (const r of FAST_STARTER_ROLES) push(r);
  return out.slice(0, 12);
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

function normalizeEmploymentType(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes("intern")) return "Internship";
  if (v.includes("contract")) return "Contract";
  if (v.includes("part") || v === "part_time") return "Part-time";
  if (v.includes("temp") || v.includes("temporary")) return "Temporary";
  if (v.includes("full") || v === "full_time") return "Full-time";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function sponsorshipFrom(text: string): boolean {
  return /visa spons|sponsori|work visa|h-1b|h1b|relocation support/i.test(text);
}

/** Pull a real application email out of the posting text, if the employer
 *  accepts applications by email. Skips no-reply / system addresses. */
export function extractApplyEmail(text: string): string | undefined {
  const matches = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
  const skip = /noreply|no-reply|donotreply|example\.(com|org)|sentry|wixpress|@2x|\.png|\.jpg/i;
  const hit = matches.find((e) => !skip.test(e));
  return hit ? hit.toLowerCase() : undefined;
}

function stripHtml(html?: string | null): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

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
      job_type?: string | null;
      publication_date?: string | null;
      description?: string | null;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.title ?? "Unknown role",
    company: j.company_name ?? "Unknown company",
    location: j.candidate_required_location || "Remote",
    url: j.url,
    haystack: [j.title, j.company_name, ...(j.tags ?? [])].filter(Boolean).join(" "),
    source: "Remotive",
    description: stripHtml(j.description),
    employmentType: normalizeEmploymentType(j.job_type),
    postedAt: j.publication_date ? Date.parse(j.publication_date) || undefined : undefined,
    tags: j.tags,
  }));
}

async function fetchArbeitnowPage(page: number): Promise<JobCandidate[]> {
  const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
  if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{
      title?: string;
      company_name?: string;
      location?: string;
      url?: string;
      tags?: string[];
      job_types?: string[] | null;
      created_at?: number | null; // unix seconds
      description?: string | null;
    }>;
  };
  return (data.data ?? []).map((j) => ({
    title: j.title ?? "Unknown role",
    company: j.company_name ?? "Unknown company",
    location: j.location ?? "Remote",
    url: j.url,
    haystack: [j.title, j.company_name, j.location, ...(j.tags ?? [])].filter(Boolean).join(" "),
    source: "Arbeitnow",
    description: stripHtml(j.description),
    employmentType: normalizeEmploymentType(j.job_types?.[0]),
    postedAt: j.created_at ? j.created_at * 1000 : undefined,
    tags: j.tags,
  }));
}

async function fetchFromArbeitnow(): Promise<JobCandidate[]> {
  // Three pages per sweep for a much wider net.
  const pages = await Promise.allSettled([1, 2, 3].map((p) => fetchArbeitnowPage(p)));
  const out: JobCandidate[] = [];
  for (const p of pages) if (p.status === "fulfilled") out.push(...p.value);
  if (out.length === 0) throw new Error("Arbeitnow returned nothing");
  return out;
}

/** Jobicy — free remote-jobs API with explicit seniority levels. */
async function fetchFromJobicy(): Promise<JobCandidate[]> {
  const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50");
  if (!res.ok) throw new Error(`Jobicy HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      url?: string;
      jobTitle?: string;
      companyName?: string;
      jobGeo?: string | null;
      jobLevel?: string | null;   // e.g. "Entry", "Mid", "Senior"
      jobType?: string | null;    // e.g. "Full Time", "Internship"
      pubDate?: string | null;
      tags?: string[] | null;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.jobTitle ?? "Unknown role",
    company: j.companyName ?? "Unknown company",
    location: j.jobGeo || "Remote",
    url: j.url,
    haystack: [j.jobTitle, j.companyName, j.jobLevel, ...(j.tags ?? [])].filter(Boolean).join(" "),
    source: "Jobicy",
    employmentType: normalizeEmploymentType(j.jobType),
    postedAt: j.pubDate ? Date.parse(j.pubDate) || undefined : undefined,
    tags: j.tags ?? undefined,
  }));
}

/* ---------------------------------------------------------------------------
 * WEB-SCALE HUNTING (no API key): DuckDuckGo's HTML search endpoint is free
 * and keyless. The engine queries it per role, restricted to company career
 * sites (Lever / Greenhouse / Ashby / Workable), so results are REAL openings
 * straight from employers — beyond what any single job board API offers.
 * ------------------------------------------------------------------------- */

async function ddgSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`DDG HTTP ${res.status}`);
  const html = await res.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const linkRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && results.length < 25) {
    let href = m[1];
    const uddg = href.match(/uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (!/^https?:\/\//.test(href)) continue;
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim();
    if (!title) continue;
    results.push({ title, url: href, snippet: "" });
  }
  const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let i = 0;
  while ((m = snipRe.exec(html)) !== null && i < results.length) {
    results[i].snippet = decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim();
    i++;
  }
  return results;
}

/** Derive the company name from an ATS posting URL. */
function companyFromAtsUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    if (/jobs\.lever\.co$/.test(host) && parts[0]) return parts[0];
    if (/(job-boards\.)?boards\.greenhouse\.io$/.test(host) && parts[0]) return parts[0];
    if (/jobs\.ashbyhq\.com$/.test(host) && parts[0]) return parts[0];
    if (/\.workable\.com$/.test(host)) return host.split(".")[0];
    if (/\.myworkdayjobs\.com$/.test(host)) return host.split(".")[0];
    return undefined;
  } catch {
    return undefined;
  }
}

/** Hunt the open web for ONE role on employer career sites. */
async function searchWebForRole(role: string): Promise<JobCandidate[]> {
  const query =
    `(site:jobs.lever.co OR site:boards.greenhouse.io OR site:job-boards.greenhouse.io ` +
    `OR site:jobs.ashbyhq.com OR site:apply.workable.com) "${role}" ` +
    `("entry level" OR junior OR graduate OR internship OR trainee)`;
  const hits = await ddgSearch(query);
  return hits.map((r) => {
    const company = companyFromAtsUrl(r.url) ?? "Unknown company";
    return {
      title: r.title,
      company: company.charAt(0).toUpperCase() + company.slice(1),
      location: "See posting",
      url: r.url,
      haystack: [r.title, company, r.snippet].filter(Boolean).join(" "),
      source: "Web search",
    } satisfies JobCandidate;
  });
}

/** Targeted Remotive hunt for ONE role — far more relevant than page 1 dumps. */
async function fetchFromRemotiveRole(role: string): Promise<JobCandidate[]> {
  const res = await fetch(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}&limit=40`,
  );
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      title?: string;
      company_name?: string;
      candidate_required_location?: string | null;
      url?: string;
      tags?: string[];
      job_type?: string | null;
      publication_date?: string | null;
      description?: string | null;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.title ?? "Unknown role",
    company: j.company_name ?? "Unknown company",
    location: j.candidate_required_location || "Remote",
    url: j.url,
    haystack: [j.title, j.company_name, ...(j.tags ?? [])].filter(Boolean).join(" "),
    source: "Remotive",
    description: stripHtml(j.description),
    employmentType: normalizeEmploymentType(j.job_type),
    postedAt: j.publication_date ? Date.parse(j.publication_date) || undefined : undefined,
    tags: j.tags,
  }));
}

/** WeWorkRemotely category RSS — employer-posted, fresh, no API key needed. */
async function fetchWwrCategory(feed: string): Promise<JobCandidate[]> {
  const res = await fetch(`https://weworkremotely.com/categories/${feed}.rss`);
  if (!res.ok) throw new Error(`WWR HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const cdata = (s: string, tag: string) =>
    s.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))?.[1] ??
    s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ??
    "";
  return items.map((item) => {
    const rawTitle = decodeEntities(cdata(item, "title").trim());
    // Titles look like "Acme Corp: Role (Anywhere)" — split them.
    const colonIdx = rawTitle.indexOf(":");
    const company = colonIdx > 0 ? rawTitle.slice(0, colonIdx).trim() : "Unknown company";
    const title = colonIdx > 0 ? rawTitle.slice(colonIdx + 1).trim() : rawTitle || "Unknown role";
    const url = cdata(item, "link").trim() || undefined;
    const pubDate = cdata(item, "pubDate").trim();
    const descHtml = cdata(item, "description");
    return {
      title,
      company,
      location: /anywhere/i.test(rawTitle) ? "Remote (Worldwide)" : "Remote",
      url,
      haystack: [title, company, stripHtml(descHtml)?.slice(0, 400)].filter(Boolean).join(" "),
      source: "WeWorkRemotely",
      postedAt: pubDate ? Date.parse(pubDate) || undefined : undefined,
      description: stripHtml(descHtml),
    } satisfies JobCandidate;
  });
}

async function fetchFromWwr(): Promise<JobCandidate[]> {
  const feeds = await Promise.allSettled([
    fetchWwrCategory("remote-programming-jobs"),
    fetchWwrCategory("remote-design-jobs"),
    fetchWwrCategory("remote-customer-support-jobs"),
  ]);
  const out: JobCandidate[] = [];
  for (const f of feeds) if (f.status === "fulfilled") out.push(...f.value);
  if (out.length === 0) throw new Error("WWR returned nothing");
  return out;
}

/** Targeted Jobicy hunt for ONE role via its tag index. */
async function fetchFromJobicyRole(role: string): Promise<JobCandidate[]> {
  const res = await fetch(
    `https://jobicy.com/api/v2/remote-jobs?count=40&tag=${encodeURIComponent(role)}`,
  );
  if (!res.ok) throw new Error(`Jobicy HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      url?: string;
      jobTitle?: string;
      companyName?: string;
      jobGeo?: string | null;
      jobLevel?: string | null;
      jobType?: string | null;
      pubDate?: string | null;
      tags?: string[] | null;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.jobTitle ?? "Unknown role",
    company: j.companyName ?? "Unknown company",
    location: j.jobGeo || "Remote",
    url: j.url,
    haystack: [j.jobTitle, j.companyName, j.jobLevel, ...(j.tags ?? [])].filter(Boolean).join(" "),
    source: "Jobicy",
    employmentType: normalizeEmploymentType(j.jobType),
    postedAt: j.pubDate ? Date.parse(j.pubDate) || undefined : undefined,
    tags: j.tags ?? undefined,
  }));
}

/** Himalayas App — free remote-jobs API with seniority metadata. */
async function fetchFromHimalayas(): Promise<JobCandidate[]> {
  const res = await fetch("https://himalayasapp.com/api/jobs?limit=50");
  if (!res.ok) throw new Error(`Himalayas HTTP ${res.status}`);
  const data = (await res.json()) as {
    jobs?: Array<{
      title?: string;
      companyName?: string;
      locationRestrictions?: string[] | null;
      applicationLink?: string | null;
      guid?: string | null;
      pubDate?: string | null;
      employmentType?: string | null;
      seniority?: string[] | null;
      keywords?: string[] | null;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    title: j.title ?? "Unknown role",
    company: j.companyName ?? "Unknown company",
    location:
      j.locationRestrictions && j.locationRestrictions.length > 0
        ? j.locationRestrictions.join(", ")
        : "Remote",
    url: j.applicationLink ?? j.guid ?? undefined,
    haystack: [j.title, j.companyName, ...(j.seniority ?? []), ...(j.keywords ?? [])].filter(Boolean).join(" "),
    source: "Himalayas",
    employmentType: normalizeEmploymentType(j.employmentType),
    postedAt: j.pubDate ? Date.parse(j.pubDate) || undefined : undefined,
    tags: j.keywords ?? undefined,
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
    date?: string;
  }>;
  return data
    .filter((j) => Boolean(j.url) && Boolean(j.position))
    .map((j) => ({
      title: j.position ?? "Unknown role",
      company: j.company ?? "Unknown company",
      location: j.location || "Remote",
      url: j.url,
      haystack: [j.position, j.company, j.location, ...(j.tags ?? [])].filter(Boolean).join(" "),
      source: "RemoteOK",
      postedAt: j.date ? Date.parse(j.date) || undefined : undefined,
      tags: j.tags,
    }));
}

const FREE_JOB_SOURCES: { name: string; fetch: () => Promise<JobCandidate[]> }[] = [
  { name: "Remotive", fetch: fetchFromRemotive },
  { name: "Arbeitnow", fetch: fetchFromArbeitnow },
  { name: "RemoteOK", fetch: fetchFromRemoteOk },
  { name: "Jobicy", fetch: fetchFromJobicy },
  { name: "Himalayas", fetch: fetchFromHimalayas },
  { name: "WeWorkRemotely", fetch: fetchFromWwr },
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
  /* CONTINUOUS TARGETED HUNTING: instead of dumping page 1 of generic boards,
   * the engine hunts EACH target role by name on every board that supports it
   * (Remotive search, Jobicy tags), plus the general pools for coverage. This
   * is what makes matches actually relevant. */
  const primaryRoles = targetRoles.slice(0, 6);
  const webRoles = targetRoles.slice(0, 3); // polite: 3 web queries per sweep
  const tasks: Promise<JobCandidate[]>[] = [
    ...primaryRoles.flatMap((role) => [
      fetchFromRemotiveRole(role),
      fetchFromJobicyRole(role),
    ]),
    ...webRoles.map((role) => searchWebForRole(role)),
    ...FREE_JOB_SOURCES.map((s) => s.fetch()),
  ];
  const settled = await Promise.allSettled(tasks);
  const candidates: JobCandidate[] = [];
  let failures = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") candidates.push(...result.value);
    else failures++;
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
  if (candidates.length === 0 && failures >= tasks.length) {
    throw new Error("All job sources unreachable");
  }
  // Clean HTML entities some boards leave in names/titles.
  for (const job of candidates) {
    job.title = decodeEntities(job.title).trim();
    job.company = decodeEntities(job.company).trim();
    job.location = decodeEntities(job.location).trim();
  }
  // Dedupe by URL AND by title+company (some boards cross-post).
  const seenUrl = new Set<string>();
  const seenKey = new Set<string>();
  const unique = candidates.filter((job) => {
    if (job.url) {
      if (seenUrl.has(job.url)) return false;
      seenUrl.add(job.url);
    }
    const key = `${job.title.toLowerCase()}@${job.company.toLowerCase()}`;
    if (seenKey.has(key)) return false;
    seenKey.add(key);
    return true;
  });

  // ACCURACY GATE:
  //  - must be fresher-appropriate (no senior/lead/3+ years)
  //  - expired postings (>45 days old) are dropped — only ACTIVE jobs
  const now = Date.now();
  const eligible = unique.filter((job) => {
    if (!isFresherFriendly(job)) return false;
    if (job.postedAt && now - job.postedAt > 45 * 24 * 60 * 60 * 1000) return false;
    return true;
  });

  const roleRegexes = targetRoles.map(
    (r) => new RegExp(`\\b${escapeRegExp(r.toLowerCase())}\\b`),
  );
  const titleHits = (job: JobCandidate) =>
    roleRegexes.some((re) => re.test(job.title.toLowerCase()));

  // Tier 1 — TITLE-VERIFIED: a target role appears in the job title itself.
  // Tier 2 — strong relevance elsewhere (tags/description + skills) to fill
  //          the batch when tier 1 is thinner than the limit.
  const scored = eligible.map((job) => ({
    job,
    score: scoreJob(job, targetRoles, skills),
    titleHit: titleHits(job),
  }));
  const tier1 = scored
    .filter((s) => s.titleHit && s.score >= 5)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.job);
  const tier1Ids = new Set(tier1.map((j) => `${j.title}@${j.company}`));
  const tier2 = scored
    .filter((s) => !tier1Ids.has(`${s.job.title}@${s.job.company}`) && s.score >= 5)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.job);

  return [...tier1, ...tier2].slice(0, limit);
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
  const roles = profile ? expandRoles(profile) : [];
  if (!profile || roles.length === 0) {
    return { ran: false, reason: "Add your details (or upload your resume) first — the engine needs to know who you are.", created: 0 };
  }
  const limit = args.limit ?? 25;
  let jobs: JobCandidate[] = [];
  let mode: "live" | "demo" = "live";
  try {
    jobs = await fetchLiveJobs(roles, profile.skills ?? [], profile.location ?? undefined, limit);
  } catch {
    jobs = [];
  }
  if (jobs.length === 0) {
    jobs = matchDemoJobs(roles, profile.skills ?? [], limit);
    mode = "demo";
  }
  if (jobs.length === 0) {
    return { ran: false, reason: "No matching jobs found this run.", created: 0 };
  }

  // Auto-apply: when the student enabled it (default ON), applications go out
  // immediately — no per-job approval step. Otherwise they queue as "matched"
  // for review.
  const auto = profile.autoApplyEnabled !== false;

  const me = await ctx.runQuery(api.users.getMe, {});
  const studentEmail: string | undefined = me?.email ?? undefined;

  // REAL applications: for postings that accept email applications, send a
  // genuine application email (tailored resume attached, Reply-To = student)
  // so companies respond straight to the student's inbox.
  let emailSent = 0;
  let emailFailed = 0;
  const toRecord = (j: JobCandidate) => {
    const applyEmail = extractApplyEmail(`${j.haystack} ${j.description ?? ""}`);
    return { j, applyEmail };
  };

  const prepared = [] as Array<
    JobCandidate & { status: "matched" | "applying" | "applied"; employmentType?: string; seniority?: string; sponsorship?: boolean; postedAt?: number; board?: string }
  >;
  for (const { j, applyEmail } of jobs.map(toRecord)) {
    const base = {
      employmentType:
        j.employmentType ?? (/intern/i.test(j.title) ? "Internship" : undefined),
      seniority: /intern/i.test(j.title)
        ? "Internship"
        : FRESH_SIGNALS.some((re) => re.test(j.title))
          ? "Entry"
          : undefined,
      sponsorship: sponsorshipFrom(`${j.title} ${j.haystack}`) || undefined,
      postedAt: j.postedAt,
      board: j.source,
    };
    if (!auto) {
      prepared.push({ ...j, ...base, status: "matched" });
      continue;
    }
    if (applyEmail && studentEmail && mode === "live") {
      const tailored = buildTailoredResume(profile, { jobTitle: j.title, company: j.company, location: j.location });
      const pdfBytes = buildTextPdf(tailored.split("\n"));
      const sig = [
        profile.fullName ? `<b>${escapeHtml(profile.fullName)}</b>` : null,
        profile.headline ? escapeHtml(profile.headline) : null,
        studentEmail ? escapeHtml(studentEmail) : null,
        profile.phone ? `Phone: ${escapeHtml(profile.phone)}` : null,
        profile.location ? `Location: ${escapeHtml(profile.location)}` : null,
      ].filter(Boolean).join(" <br/>");
      const sent = await ctx.runAction(api.email.sendDigest, {
        to: applyEmail,
        subject: `Application: ${j.title} — ${profile.fullName ?? "Fresher candidate"}`,
        html:
          `<p>Dear Hiring Team,</p>` +
          `<p>I am writing to apply for the <b>${escapeHtml(j.title)}</b> position at ${escapeHtml(j.company)}. ` +
          `As a fresher eager to begin my career, I have tailored my resume to the skills this role values` +
          `${profile.location ? ` and I am based in ${escapeHtml(profile.location)}, ready to contribute from day one` : ""}.</p>` +
          `<p>My resume is attached for your review. I would greatly appreciate the opportunity to interview at your convenience and demonstrate my motivation in person.</p>` +
          `<p>Thank you for your time and consideration.</p>` +
          `<p style=\"margin-top:16px\">${sig}</p>`,
        replyTo: studentEmail,
        attachmentName: `${(profile.fullName ?? "Resume").replace(/[^\w]+/g, "_")}_${j.title.replace(/[^\w]+/g, "_").slice(0, 30)}.pdf`,
        attachmentBase64: bytesToBase64(pdfBytes),
      });
      if (sent.sent) {
        emailSent++;
        prepared.push({ ...j, ...base, status: "applied" });
        continue;
      }
      emailFailed++;
    }
    // Portal job (or email sending not configured): engine prepared everything,
    // the posting opens pre-filled with one click on Submit.
    prepared.push({ ...j, ...base, status: "applying" });
  }

  const { created, ids } = await ctx.runMutation(api.applications.recordMany, {
    jobs: prepared.map((j) => ({
      jobTitle: j.title,
      company: j.company,
      location: j.location,
      sourceUrl: j.url,
      status: j.status,
      employmentType: j.employmentType,
      seniority: j.seniority,
      sponsorship: j.sponsorship,
      postedAt: j.postedAt,
      board: j.board,
    })),
  });

  // Live engine status for the dashboard panel.
  await ctx.runMutation(api.profiles.markEngineRun, { found: created });

  // Real submissions summary: how many went out as genuine application emails.
  const submittedCount = prepared.filter((j) => j.status === "applied").length;
  const readyCount = prepared.filter((j) => j.status === "applying").length;
  // Build a tailored resume for every newly recorded job, from the student's
  // profile + source documents, so each application ships with a
  // job-specific resume.
  for (const applicationId of ids) {
    await ctx.runMutation(api.resumeGen.generateForUser, { userId, applicationId });
  }
  await ctx.runMutation(api.notifications.createMany, {
    items: [
      {
        kind: "application_submitted",
        title:
          submittedCount > 0
            ? `Applied to ${submittedCount} jobs — ${readyCount} ready`
            : mode === "live"
              ? `Engine found ${created} new jobs`
              : `Engine applied to ${created} demo jobs`,
        body:
          submittedCount > 0
            ? `${submittedCount} application emails were sent with your resume — replies land in your inbox. ${readyCount > 0 ? `${readyCount} portal jobs are one-click Submit.` : ""}`
            : mode === "live"
              ? "They are pre-filled and ready on the Applications tab — hit Submit."
              : "Live job sources were unreachable — showing demo jobs. Try again later.",
      },
    ],
  });

  // Immediate receipt to the student's own inbox after every sweep.
  let email: ChannelResult | null = null;
  {
    const me2 = await ctx.runQuery(api.users.getMe, {});
    if (me2?.email) {
      email = await ctx.runAction(api.email.sendDigest, {
        to: me2.email,
        subject:
          submittedCount > 0
            ? `FirstStep applied to ${submittedCount} jobs for you (+${readyCount} ready)`
            : mode === "live"
              ? `FirstStep found ${created} new jobs for you`
              : `FirstStep: ${created} applications submitted`,
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
    if (!profile.autoApplyEnabled) continue;
    const roles = expandRoles(profile);
    if (roles.length === 0) continue;
    let jobs: JobCandidate[] = [];
    let mode: "live" | "demo" = "live";
    try {
      jobs = await fetchLiveJobs(roles, profile.skills ?? [], profile.location ?? undefined, 20);
    } catch {
      jobs = [];
    }
    if (jobs.length === 0) {
      jobs = matchDemoJobs(roles, profile.skills ?? [], 20);
      mode = "demo";
    }
    if (jobs.length === 0) continue;

    // The cron only runs for students who enabled auto-apply — apply for real:
    // email applications go out with the tailored resume attached.
    const me = await ctx.runQuery(api.users.getUserById, { userId: profile.userId });
    const studentEmail: string | undefined = me?.email ?? undefined;
    let submittedCount = 0;
    const preparedCron = [] as Array<
      JobCandidate & { status: "applying" | "applied"; employmentType?: string; seniority?: string; sponsorship?: boolean; postedAt?: number; board?: string }
    >;
    for (const j of jobs) {
      const base = {
        employmentType:
          j.employmentType ?? (/intern/i.test(j.title) ? "Internship" : undefined),
        seniority: /intern/i.test(j.title)
          ? "Internship"
          : FRESH_SIGNALS.some((re) => re.test(j.title))
            ? "Entry"
            : undefined,
        sponsorship: sponsorshipFrom(`${j.title} ${j.haystack}`) || undefined,
        postedAt: j.postedAt,
        board: j.source,
      };
      const applyEmail = extractApplyEmail(`${j.haystack} ${j.description ?? ""}`);
      if (mode === "live" && applyEmail && studentEmail) {
        const tailored = buildTailoredResume(profile, { jobTitle: j.title, company: j.company, location: j.location });
        const sent = await ctx.runAction(api.email.sendDigest, {
          to: applyEmail,
          subject: `Application: ${j.title} — ${profile.fullName ?? "Fresher candidate"}`,
          html:
            `<p>Dear Hiring Team,</p>` +
            `<p>I am applying for the <b>${escapeHtml(j.title)}</b> role at ${escapeHtml(j.company)}. ` +
            `I am a fresher actively looking to start my career.</p>` +
            `<p>My tailored resume is attached. Thank you for your time,<br/>${escapeHtml(profile.fullName ?? "Candidate")}${studentEmail ? ` · ${escapeHtml(studentEmail)}` : ""}</p>`,
          replyTo: studentEmail,
          attachmentName: `${(profile.fullName ?? "Resume").replace(/[^\w]+/g, "_")}_Resume.pdf`,
          attachmentBase64: bytesToBase64(buildTextPdf(tailored.split("\n"))),
        });
        if (sent.sent) submittedCount++;
        preparedCron.push({ ...j, ...base, status: sent.sent ? "applied" : "applying" });
        continue;
      }
      preparedCron.push({ ...j, ...base, status: "applying" });
    }

    const { created, ids } = await ctx.runMutation(api.applications.recordManyForUser, {
      userId: profile.userId,
      jobs: preparedCron.map((j) => ({
        jobTitle: j.title,
        company: j.company,
        location: j.location,
        sourceUrl: j.url,
        status: j.status,
        employmentType: j.employmentType,
        seniority: j.seniority,
        sponsorship: j.sponsorship,
        postedAt: j.postedAt,
        board: j.board,
      })),
    });
    await ctx.runMutation(api.profiles.markEngineRunForUser, {
      userId: profile.userId,
      found: created,
    });
    if (created === 0) continue;
    // Tailored resume per job, generated from the student's profile + documents.
    for (const applicationId of ids) {
      await ctx.runMutation(api.resumeGen.generateForUser, {
        userId: profile.userId,
        applicationId,
      });
    }
    totalCreated += created;
    await ctx.runMutation(api.notifications.createManyForUser, {
      userId: profile.userId,
      items: [
        {
          kind: "application_submitted",
          title:
            submittedCount > 0
              ? `Applied to ${submittedCount} new jobs while you were away`
              : mode === "live"
                ? `Engine found ${created} new jobs`
                : `Engine applied to ${created} demo jobs`,
          body:
            submittedCount > 0
              ? `${submittedCount} real application emails sent from your profile — replies land in your inbox.`
              : mode === "live"
                ? "They are pre-filled and ready — hit Submit on the Applications tab."
                : "Live boards were unreachable — showing demo jobs.",
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
