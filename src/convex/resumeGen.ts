import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

type ProfileLike = {
  fullName?: string;
  headline?: string;
  location?: string;
  skills?: string[];
  targetRoles?: string[];
  education?: string[];
};

type JobLike = {
  jobTitle: string;
  company: string;
  location: string;
};

/**
 * Build a plain-text resume tailored to ONE specific job posting.
 *
 * The engine reorders the student's skills so the ones the job cares about
 * come first, and writes a summary that names the exact role + company — the
 * classic "tailored resume" technique, done automatically and for free.
 */
export function buildTailoredResume(profile: ProfileLike, job: JobLike): string {
  const name = profile.fullName ?? "Candidate";
  const skills = profile.skills ?? [];
  const targetRoles = profile.targetRoles ?? [];

  // Score each skill by how strongly the job posting mentions it.
  const jobHaystack = `${job.jobTitle} ${job.company} ${job.location}`.toLowerCase();
  const scored = skills.map((skill) => {
    let score = 0;
    const s = skill.toLowerCase();
    if (jobHaystack.includes(s)) score += 3;
    if (targetRoles.some((r) => r.toLowerCase().includes(s))) score += 1;
    return { skill, score };
  });
  const orderedSkills = [...scored]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.skill);

  const topSkills = orderedSkills.slice(0, 4);
  const rolePhrase = targetRoles[0] ?? job.jobTitle;
  const summary = `Motivated ${rolePhrase} candidate skilled in ${topSkills.join(", ")}. ` +
    `Seeking an entry-level opportunity as ${job.jobTitle} at ${job.company}, ` +
    `where I can apply my skills in ${topSkills.join(", ")} and grow with the team.`;

  const education = profile.education ?? [];
  const educationBlock =
    education.length > 0
      ? education.map((e) => `• ${e}`).join("\n")
      : `• ${profile.headline ?? "Relevant coursework and self-study"}`;

  const contact = [
    profile.location ?? "",
    "Email available on request",
    "Phone available on request",
  ]
    .filter(Boolean)
    .join(" | ");

  return [
    name.toUpperCase(),
    contact,
    "",
    "PROFESSIONAL SUMMARY",
    summary,
    "",
    "SKILLS",
    orderedSkills.length > 0 ? orderedSkills.join(", ") : "—",
    "",
    "EDUCATION",
    educationBlock,
  ].join("\n");
}

/**
 * Generate (or regenerate) the tailored resume for one of the signed-in user's
 * applications and store it on the application row.
 */
export const generateResume = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.userId !== userId) throw new Error("Application not found");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete your profile first");

    const resume = buildTailoredResume(profile, app);
    await ctx.db.patch(args.applicationId, { generatedResume: resume });
    return { ok: true, resume };
  },
});

/**
 * Internal variant used by the engine cron (no signed-in user). NOT exposed in
 * the UI. (Gate with an admin check before exposing publicly in production.)
 */
export const generateForUser = mutation({
  args: { userId: v.id("users"), applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.userId !== args.userId) throw new Error("Application not found");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!profile) return { ok: false, reason: "Profile missing" };

    const resume = buildTailoredResume(profile, app);
    await ctx.db.patch(args.applicationId, { generatedResume: resume });
    return { ok: true, resume };
  },
});
