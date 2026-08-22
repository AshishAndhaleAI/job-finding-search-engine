import { v } from "convex/values";
import { mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/* ---------------------------------------------------------------------------
 * Chunked uploads — the whole file travels through the normal Convex
 * mutation/action channel (the exact transport used by sign-in, profile saves
 * and the engine). There are no signed URLs, no binary HTTP endpoints, no CORS
 * and no proxy hops left to break.
 *
 *   1. beginChunkedUpload   – create a staging session (returns sessionId)
 *   2. pushUploadChunk      – one small base64 piece per call
 *   3. finalizeChunkedUpload– server reassembles → ctx.storage.store()
 * ------------------------------------------------------------------------- */

const CHUNK_MAX_AGE_MS = 24 * 60 * 60 * 1000; // clean abandoned sessions after a day

/** Create an upload session for the signed-in student. */
export const beginChunkedUpload = mutation({
  args: {
    fileName: v.string(),
    mimeType: v.string(),
    totalChunks: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    if (args.totalChunks < 1 || args.totalChunks > 5000) {
      throw new Error("Invalid file size (empty or too large).");
    }
    // Opportunistic cleanup of this user's abandoned sessions.
    const cutoff = Date.now() - CHUNK_MAX_AGE_MS;
    const mine = await ctx.db
      .query("uploadSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of mine) {
      if (s.createdAt < cutoff) {
        const chunks = await ctx.db
          .query("uploadChunks")
          .withIndex("sessionId_index", (q) => q.eq("sessionId", s._id))
          .collect();
        for (const c of chunks) await ctx.db.delete(c._id);
        await ctx.db.delete(s._id);
      }
    }
    return await ctx.db.insert("uploadSessions", {
      userId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      totalChunks: args.totalChunks,
      createdAt: Date.now(),
    });
  },
});

/** Push one chunk (base64) of the file. Idempotent per index. */
export const pushUploadChunk = mutation({
  args: {
    sessionId: v.id("uploadSessions"),
    index: v.number(),
    data: v.string(),
  },
  handler: async (ctx, { sessionId, index, data }) => {
    const userId = await getAuthUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Upload session not found — restart the upload.");
    }
    if (index < 0 || index >= session.totalChunks) {
      throw new Error("Chunk index out of range.");
    }
    if (data.length === 0 || data.length > 1_500_000) {
      throw new Error("Chunk size out of allowed range.");
    }
    const existing = await ctx.db
      .query("uploadChunks")
      .withIndex("sessionId_index", (q) =>
        q.eq("sessionId", sessionId).eq("index", index),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { data });
      return;
    }
    await ctx.db.insert("uploadChunks", { sessionId, index, data });
  },
});

/**
 * Reassemble all chunks and store the finished file in Convex storage.
 * Returns { storageId } exactly like the old flow, so resume scanning and
 * profile saving continue unchanged.
 */
export const finalizeChunkedUpload = action({
  args: { sessionId: v.id("uploadSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");

    const session = await ctx.runQuery(internal.uploads.getSessionInternal, {
      sessionId,
    });
    if (!session) throw new Error("Upload session not found.");
    if (session.userId !== userId) throw new Error("Not your upload session.");

    const rows: { data: string }[] = await ctx.runQuery(internal.uploads.getChunksInternal, {
      sessionId,
    });
    if (rows.length !== session.totalChunks) {
      throw new Error(
        `Upload incomplete (${rows.length}/${session.totalChunks} parts) — try again.`,
      );
    }

    // Decode each chunk and assemble the full file as bytes.
    const parts = rows.map((r) => base64ToBytes(r.data));
    const total = parts.reduce((n, p) => n + p.length, 0);
    if (total === 0) throw new Error("Uploaded file was empty.");
    if (total > 20 * 1024 * 1024) throw new Error("File is larger than 20 MB.");
    const file = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      file.set(p, offset);
      offset += p.length;
    }

    const storageId = await ctx.storage.store(
      new Blob([file], { type: session.mimeType }),
    );

    // Staging data is no longer needed.
    await ctx.runMutation(internal.uploads.deleteSessionInternal, { sessionId });

    return { storageId, size: total };
  },
});

/** Base64 -> bytes without Node APIs (this action runs in the V8 isolate). */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ------------------------------ internals -------------------------------- */

export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("uploadSessions") },
  handler: async (ctx, { sessionId }) => await ctx.db.get(sessionId),
});

export const getChunksInternal = internalQuery({
  args: { sessionId: v.id("uploadSessions") },
  handler: async (ctx, { sessionId }) =>
    await ctx.db
      .query("uploadChunks")
      .withIndex("sessionId_index", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect(),
});

export const deleteSessionInternal = internalMutation({
  args: { sessionId: v.id("uploadSessions") },
  handler: async (ctx, { sessionId }) => {
    const chunks = await ctx.db
      .query("uploadChunks")
      .withIndex("sessionId_index", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const c of chunks) await ctx.db.delete(c._id);
    await ctx.db.delete(sessionId);
  },
});
