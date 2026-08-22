import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { applicationStatus } from "./schema";

export const list = query({
  args: { status: v.optional(applicationStatus) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const base = ctx.db.query("applications");
    const q = args.status
      ? base.withIndex("userId_status", (row) =>
          row.eq("userId", userId).eq("status", args.status!),
        )
      : base.withIndex("userId", (row) => row.eq("userId", userId));
    return await q.order("desc").collect();
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const applications = await ctx.db
      .query("applications")
      .withIndex("userId", (row) => row.eq("userId", userId))
      .collect();
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (row) => row.eq("userId", userId))
      .collect();
    return {
      total: applications.length,
      matched: applications.filter((a) => a.status === "matched").length,
      applied: applications.filter((a) => a.status === "applied").length,
      interviews: applications.filter((a) => a.status === "interview").length,
      offers: applications.filter((a) => a.status === "offered").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
      unreadNotifications: notifications.filter((n) => !n.read).length,
      lastApplicationAt:
        applications.length > 0
          ? Math.max(...applications.map((a) => a.createdAt))
          : null,
    };
  },
});

/**
 * Record a batch of jobs the engine found. Called by the engine action.
 * Skips jobs whose sourceUrl was already recorded for this user.
 */
export const recordMany = mutation({
  args: {
    jobs: v.array(
      v.object({
        jobTitle: v.string(),
        company: v.string(),
        location: v.string(),
        sourceUrl: v.optional(v.string()),
        status: applicationStatus,
        employmentType: v.optional(v.string()),
        seniority: v.optional(v.string()),
        sponsorship: v.optional(v.boolean()),
        postedAt: v.optional(v.number()),
        board: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();
    const ids: Id<"applications">[] = [];
    for (const job of args.jobs) {
      if (job.sourceUrl) {
        const existing = await ctx.db
          .query("applications")
          .withIndex("userId", (row) => row.eq("userId", userId))
          .filter((row) => row.eq(row.field("sourceUrl"), job.sourceUrl))
          .first();
        if (existing) continue;
      }
      const id = await ctx.db.insert("applications", {
        userId,
        jobTitle: job.jobTitle,
        company: job.company,
        location: job.location,
        sourceUrl: job.sourceUrl,
        source: "engine",
        status: job.status,
        employmentType: job.employmentType,
        seniority: job.seniority,
        sponsorship: job.sponsorship,
        postedAt: job.postedAt,
        board: job.board,
        createdAt: now,
        appliedAt: job.status === "applied" ? now : undefined,
      });
      ids.push(id);
    }
    return { created: ids.length, ids };
  },
});

/**
 * Internal batch recording for the daily engine cron, which runs without a
 * signed-in user. NOT exposed to the UI. (Gate with an admin check before
 * exposing this publicly in production.)
 */
export const recordManyForUser = mutation({
  args: {
    userId: v.id("users"),
    jobs: v.array(
      v.object({
        jobTitle: v.string(),
        company: v.string(),
        location: v.string(),
        sourceUrl: v.optional(v.string()),
        status: applicationStatus,
        employmentType: v.optional(v.string()),
        seniority: v.optional(v.string()),
        sponsorship: v.optional(v.boolean()),
        postedAt: v.optional(v.number()),
        board: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids: Id<"applications">[] = [];
    for (const job of args.jobs) {
      if (job.sourceUrl) {
        const existing = await ctx.db
          .query("applications")
          .withIndex("userId", (row) => row.eq("userId", args.userId))
          .filter((row) => row.eq(row.field("sourceUrl"), job.sourceUrl))
          .first();
        if (existing) continue;
      }
      const id = await ctx.db.insert("applications", {
        userId: args.userId,
        jobTitle: job.jobTitle,
        company: job.company,
        location: job.location,
        sourceUrl: job.sourceUrl,
        source: "engine",
        status: job.status,
        employmentType: job.employmentType,
        seniority: job.seniority,
        sponsorship: job.sponsorship,
        postedAt: job.postedAt,
        board: job.board,
        createdAt: now,
        appliedAt: job.status === "applied" ? now : undefined,
      });
      ids.push(id);
    }
    return { created: ids.length, ids };
  },
});

export const updateStatus = mutation({
  args: { id: v.id("applications"), status: applicationStatus },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const app = await ctx.db.get(args.id);
    if (!app || app.userId !== userId) throw new Error("Application not found");
    await ctx.db.patch(args.id, {
      status: args.status,
      appliedAt: args.status === "applied" ? Date.now() : app.appliedAt,
    });
  },
});
