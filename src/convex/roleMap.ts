/**
 * Entry-level roles each detected skill makes a fresher employable for.
 * Shared by the resume scanner and the engine so both widen the job search
 * beyond the roles the student typed — more (still-relevant) applications
 * means a faster first job.
 *
 * NOTE: intentionally a plain module (no "use node") so any Convex function
 * can import it without pulling Node.js APIs into the V8 isolate.
 */

export const SKILL_TO_ROLES: Record<string, string[]> = {
  "python": ["data analyst", "qa engineer", "software engineer"],
  "java": ["software engineer", "backend developer"],
  "javascript": ["frontend developer", "software engineer"],
  "typescript": ["frontend developer", "software engineer"],
  "react": ["frontend developer", "software engineer"],
  "node.js": ["backend developer", "software engineer"],
  "nodejs": ["backend developer", "software engineer"],
  "sql": ["data analyst", "business analyst"],
  "mysql": ["data analyst"],
  "postgresql": ["data analyst", "backend developer"],
  "mongodb": ["backend developer"],
  "excel": ["data analyst", "data entry", "operations associate"],
  "power bi": ["data analyst"],
  "tableau": ["data analyst"],
  "pandas": ["data analyst", "data scientist"],
  "machine learning": ["data scientist", "data analyst"],
  "aws": ["cloud engineer", "devops engineer"],
  "azure": ["cloud engineer"],
  "docker": ["devops engineer"],
  "linux": ["devops engineer", "it support"],
  "git": ["software engineer"],
  "selenium": ["qa engineer", "test engineer"],
  "manual testing": ["qa engineer", "test engineer"],
  "automation testing": ["qa engineer", "automation engineer"],
  "figma": ["ux designer", "ui designer", "graphic designer"],
  "photoshop": ["graphic designer"],
  "canva": ["graphic designer", "digital marketing"],
  "autocad": ["mechanical engineer", "civil engineer"],
  "solidworks": ["mechanical engineer"],
  "matlab": ["electrical engineer", "mechanical engineer"],
  "communication": ["customer support", "sales executive", "hr assistant"],
  "leadership": ["project coordinator", "management trainee"],
  "teamwork": ["operations associate", "customer service"],
  "content writing": ["content writer", "digital marketing"],
  "seo": ["digital marketing", "content writer"],
  "accounting": ["accountant", "financial analyst"],
  "tally": ["accountant"],
};

/** Roles derivable purely from the student's detected skills. */
export function rolesFromSkills(skills: string[]): string[] {
  const out: string[] = [];
  for (const raw of skills) {
    const mapped = SKILL_TO_ROLES[raw.toLowerCase().trim()];
    if (!mapped) continue;
    for (const r of mapped) if (!out.includes(r)) out.push(r);
  }
  return out;
}
