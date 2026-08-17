"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

/* ---------------------------------------------------------------------------
 * Resume parsing — 100% free, no API keys.
 * Extracts text from PDF / DOCX / TXT and pulls out the fields the engine
 * needs (name, contact, location, skills, target roles) using heuristics.
 * The student reviews the suggestions before saving.
 * ------------------------------------------------------------------------- */

const COMMON_SKILLS = [
  "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go", "swift", "kotlin",
  "html", "css", "react", "node.js", "nodejs", "angular", "vue", "django", "flask", "spring",
  "sql", "mysql", "postgresql", "mongodb", "excel", "power bi", "tableau", "pandas", "numpy",
  "aws", "azure", "gcp", "docker", "kubernetes", "linux", "git", "jenkins", "terraform",
  "selenium", "manual testing", "automation testing", "jmeter", "postman", "api testing",
  "figma", "photoshop", "illustrator", "canva", "adobe xd", "sketch",
  "communication", "leadership", "teamwork", "problem solving", "critical thinking",
  "time management", "project management", "agile", "scrum", "presentation", "negotiation",
  "autocad", "solidworks", "matlab", "simulink", "catia", "ansys", "labview",
  "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "scikit-learn",
  "data analysis", "data visualization", "statistics", "r", "sas", "spss",
  "cybersecurity", "network security", "ethical hacking", "wireshark", "nmap",
  "salesforce", "hubspot", "zoho", "erp", "sap",
  "word", "powerpoint", "outlook", "google sheets", "google analytics",
];

const TARGET_ROLES = [
  "software engineer", "frontend developer", "backend developer", "full stack developer",
  "data analyst", "data scientist", "business analyst", "financial analyst",
  "qa engineer", "test engineer", "devops engineer", "cloud engineer",
  "product manager", "project coordinator", "project manager",
  "marketing coordinator", "digital marketing", "content writer", "graphic designer",
  "ux designer", "ui designer", "hr assistant", "hr executive",
  "sales development representative", "sales executive", "customer support",
  "customer service", "it support", "cybersecurity analyst", "network engineer",
  "mobile developer", "android developer", "ios developer", "embedded engineer",
  "mechanical engineer", "electrical engineer", "civil engineer", "automation engineer",
  "robotics engineer", "data entry", "operations associate", "accountant", "recruiter",
];

const LOCATIONS = [
  "mumbai", "delhi", "bengaluru", "bangalore", "hyderabad", "pune", "chennai", "kolkata",
  "ahmedabad", "gurgaon", "noida", "jaipur", "kochi", "chandigarh", "indore",
  "new york", "san francisco", "los angeles", "seattle", "austin", "chicago", "boston",
  "london", "manchester", "berlin", "munich", "paris", "amsterdam", "dublin", "zurich",
  "toronto", "vancouver", "montreal", "sydney", "melbourne", "singapore", "hong kong",
  "tokyo", "dubai", "abu dhabi", "qatar", "riyadh", "warsaw", "prague", "madrid",
  "barcelona", "milan", "stockholm", "oslo", "helsinki", "copenhagen", "brussels",
  "vienna", "warsaw", "lisbon", "athens", "istanbul", "tel aviv", "jakarta", "kuala lumpur",
  "bangkok", "manila", "saudi arabia", "united states", "usa", "united kingdom", "uk",
  "india", "canada", "australia", "germany", "france", "netherlands", "ireland",
  "switzerland", "singapore", "uae", "remote", "worldwide",
];

/** Normalized text without excessive whitespace, for line-based heuristics. */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmail(text: string): string | undefined {
  return text.match(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/)?.[0];
}

function extractPhone(text: string): string | undefined {
  // Prefer an international-style number (e.g. +91 98765 43210, +1 555 123 4567).
  const international = text.match(/(\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4})/);
  if (international) return international[1].replace(/[\s-]/g, "");
  // Fall back to a plain 10-digit number (common in India).
  const tenDigit = text.match(/\b\d{10}\b/);
  return tenDigit?.[0];
}

function extractName(lines: string[]): string | undefined {
  // Prefer explicit labels.
  for (const line of lines) {
    const labeled = line.match(/^(?:name|full name|student name)\s*[:\-]\s*(.+)$/i);
    if (labeled) {
      const value = labeled[1].trim();
      if (/^[A-Za-z][A-Za-z' .-]{2,60}$/.test(value)) return value;
    }
  }
  // Otherwise use the first line that looks like a person's name.
  const SKIP = new Set(["resume", "curriculum vitae", "cv", "profile", "summary", "education", "experience", "skills", "projects", "contact", "objective", "email", "phone", "linkedin", "github"]);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 60) continue;
    if (/[@\d]/.test(trimmed)) continue;
    if (SKIP.has(trimmed.toLowerCase())) continue;
    const words = trimmed.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w))) return trimmed;
  }
  return undefined;
}

function extractLocation(text: string): string | undefined {
  // A line mentioning "location" or "based in" is the strongest signal.
  const explicit = text.match(/(?:location|based in|currently in|from)\s*[:\-]?\s*([A-Za-z ,-]{3,40})/i);
  if (explicit) {
    const candidate = explicit[1].trim();
    if (LOCATIONS.some((l) => candidate.toLowerCase().includes(l))) {
      return candidate.split(",")[0].trim();
    }
  }
  // Otherwise the longest matching known place wins (most specific).
  const lower = text.toLowerCase();
  let best: string | undefined;
  for (const loc of LOCATIONS) {
    if (new RegExp(`\\b${loc}\\b`).test(lower)) {
      if (!best || loc.length > best.length) best = loc;
    }
  }
  return best ? best.charAt(0).toUpperCase() + best.slice(1) : undefined;
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of COMMON_SKILLS) {
    if (new RegExp(`\\b${skill.replace(/[.+]/g, "\\$&")}\\b`).test(lower)) {
      found.push(skill);
    }
  }
  return found.slice(0, 15);
}

function extractRoles(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const role of TARGET_ROLES) {
    if (new RegExp(`\\b${role}\\b`).test(lower)) {
      found.push(role);
    }
  }
  return found.slice(0, 5);
}

function extractEducation(lines: string[]): string[] {
  const DEGREE_WORDS = new Set([
    "bachelor", "b.sc", "bsc", "b.tech", "btech", "b.e", "bachelor of", "master", "m.sc",
    "msc", "m.tech", "mtech", "m.e", "mba", "bca", "mca", "diploma", "ph.d", "phd",
    "b.com", "bcom", "m.com", "mcom", "b.a", "ba", "m.a", "ma", "b.ed", "m.ed",
    "b.des", "b.arch", "b.optom", "b.pharm", "bhm", "bhmct", "b.voc",
  ]);
  const found: string[] = [];
  let inEducation = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^education$/i.test(line)) {
      inEducation = true;
      continue;
    }
    if (inEducation && /^(experience|projects|skills|certifications?|languages|hobbies|summary|objective|profile)$/i.test(line)) {
      inEducation = false;
    }
    const isDegreeLine =
      inEducation ||
      [...DEGREE_WORDS].some((w) => new RegExp(`\\b${w.replace(/[.+]/g, "\\$&")}\\b`).test(lower));
    if (isDegreeLine && line.length < 120 && !/@|\\+/.test(line)) {
      found.push(line.trim());
      if (found.length >= 4) break;
    }
  }
  return found;
}

function detectKind(bytes: Uint8Array, name?: string): "pdf" | "docx" | "text" | "unknown" {
  const head = String.fromCharCode(...bytes.slice(0, 4));
  if (head.startsWith("%PDF")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "docx"; // ZIP container
  if (name?.toLowerCase().endsWith(".docx")) return "docx";
  if (name?.toLowerCase().endsWith(".txt")) return "text";
  return "text";
}

async function extractText(
  kind: "pdf" | "docx" | "text" | "unknown",
  bytes: Uint8Array,
): Promise<string> {
  if (kind === "pdf") {
    const parsed = await pdfParse(Buffer.from(bytes));
    return parsed.text ?? "";
  }
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value ?? "";
  }
  return Buffer.from(bytes).toString("utf8");
}

export const parseResume = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const stored = await ctx.storage.get(args.storageId);
    if (!stored) return { ok: false, reason: "File not found in storage." };

    const bytes = new Uint8Array(await stored.arrayBuffer());
    const kind = detectKind(bytes);
    if (kind === "unknown") {
      return { ok: false, reason: "Unsupported file type — upload a PDF or DOCX resume." };
    }

    let text: string;
    try {
      text = cleanText(await extractText(kind, bytes));
    } catch {
      return { ok: false, reason: "Could not read the file — it may be corrupted." };
    }
    if (text.length < 20) {
      return { ok: false, reason: "No readable text found in this file (scanned images aren't supported yet)." };
    }

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      ok: true,
      name: extractName(lines),
      email: extractEmail(text),
      phone: extractPhone(text),
      location: extractLocation(text),
      skills: extractSkills(text),
      targetRoles: extractRoles(text),
      education: extractEducation(lines),
    };
  },
});
