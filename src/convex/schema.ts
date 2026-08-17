import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Application lifecycle:
 * matched   – the engine found the job and is queued to apply
 * applying  – an application is being submitted
 * applied   – application submitted
 * interview – the student got an interview
 * rejected  – the company declined
 * offered   – the student received an offer
 */
export const applicationStatuses = [
  "matched",
  "applying",
  "applied",
  "interview",
  "rejected",
  "offered",
] as const;

export const applicationStatus = v.union(
  v.literal("matched"),
  v.literal("applying"),
  v.literal("applied"),
  v.literal("interview"),
  v.literal("rejected"),
  v.literal("offered"),
);

export default defineSchema({
  // Tables managed by Convex Auth (@convex-dev/auth): users, authSessions,
  // authAccounts, authVerificationRequests, authRateLimits, etc.
  ...authTables,

  // One row per student: what the engine uses to search + apply.
  profiles: defineTable({
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),
    remote: v.optional(v.boolean()),
    experienceYears: v.optional(v.number()),
    skills: v.optional(v.array(v.string())),
    targetRoles: v.optional(v.array(v.string())),
    // Education entries (e.g. "BSc Computer Science — Pune University"), parsed
    // from the student's resume documents and used to build tailored resumes.
    education: v.optional(v.array(v.string())),
    resumeStorageId: v.optional(v.id("_storage")),
    autoApplyEnabled: v.optional(v.boolean()),
    emailDigestEnabled: v.optional(v.boolean()),
    // WhatsApp notifications (Meta WhatsApp Business Cloud API). `phone` is
    // the student's number in E.164 format, e.g. +15551234567.
    phone: v.optional(v.string()),
    whatsappEnabled: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("userId", ["userId"]),

  // Every job the engine found / applied to for a student.
  applications: defineTable({
    userId: v.id("users"),
    jobTitle: v.string(),
    company: v.string(),
    location: v.string(),
    sourceUrl: v.optional(v.string()),
    source: v.union(v.literal("engine"), v.literal("manual")),
    status: applicationStatus,
    createdAt: v.number(),
    appliedAt: v.optional(v.number()),
    // Tailored resume the engine built for this specific job posting.
    generatedResume: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("userId_status", ["userId", "status"]),

  // In-app notifications; email digests are sent by the engine when enabled.
  notifications: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("application_submitted"),
      v.literal("interview"),
      v.literal("offer"),
      v.literal("digest"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("userId", ["userId"]),
});
