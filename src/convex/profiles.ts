import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * All profiles. Used only by the engine cron (engineDaily). Not exposed in the UI.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("profiles").collect();
  },
});

export const getProfileById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const upsertProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),
    remote: v.optional(v.boolean()),
    experienceYears: v.optional(v.number()),
    skills: v.optional(v.array(v.string())),
    targetRoles: v.optional(v.array(v.string())),
    education: v.optional(v.array(v.string())),
    autoApplyEnabled: v.optional(v.boolean()),
    emailDigestEnabled: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    whatsappEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("profiles", {
      userId,
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Store the storage id of an uploaded resume on the profile. */
export const setResume = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { resumeStorageId: args.storageId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("profiles", {
      userId,
      resumeStorageId: args.storageId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getResumeUrl = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile?.resumeStorageId) return null;
    return await ctx.storage.getUrl(profile.resumeStorageId);
  },
});
