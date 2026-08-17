import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const q = ctx.db
      .query("notifications")
      .withIndex("userId", (row) => row.eq("userId", userId))
      .order("desc");
    const items = args.limit ? await q.take(args.limit) : await q.collect();
    return items;
  },
});

export const createMany = mutation({
  args: {
    items: v.array(
      v.object({
        kind: v.union(
          v.literal("application_submitted"),
          v.literal("interview"),
          v.literal("offer"),
          v.literal("digest"),
          v.literal("system"),
        ),
        title: v.string(),
        body: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const now = Date.now();
    for (const item of args.items) {
      await ctx.db.insert("notifications", {
        userId,
        kind: item.kind,
        title: item.title,
        body: item.body,
        read: false,
        createdAt: now,
      });
    }
    return args.items.length;
  },
});

export const createManyForUser = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        kind: v.union(
          v.literal("application_submitted"),
          v.literal("interview"),
          v.literal("offer"),
          v.literal("digest"),
          v.literal("system"),
        ),
        title: v.string(),
        body: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const item of args.items) {
      await ctx.db.insert("notifications", {
        userId: args.userId,
        kind: item.kind,
        title: item.title,
        body: item.body,
        read: false,
        createdAt: now,
      });
    }
    return args.items.length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const items = await ctx.db
      .query("notifications")
      .withIndex("userId", (row) => row.eq("userId", userId))
      .collect();
    for (const item of items) {
      if (!item.read) await ctx.db.patch(item._id, { read: true });
    }
  },
});
