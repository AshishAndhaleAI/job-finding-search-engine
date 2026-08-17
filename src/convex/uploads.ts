import { mutation } from "./_generated/server";

/** Get a one-time upload URL for the resume file (Convex storage). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
