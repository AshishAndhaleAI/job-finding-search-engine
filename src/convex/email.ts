import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Send a transactional email via Brevo (https://brevo.com) — free plan: up to
 * 300 emails/day, no credit card required. Requires BREVO_API_KEY and
 * EMAIL_FROM to be set (Freebuff Keys tab); returns { sent: false, reason }
 * when the integration is not configured so the rest of the app keeps working
 * without it.
 *
 * Note: Brevo requires you to verify the sender address (EMAIL_FROM) once in
 * the Brevo dashboard before it will deliver mail.
 */
export const sendDigest = action({
  args: { to: v.string(), subject: v.string(), html: v.string() },
  handler: async (_ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey) return { sent: false, reason: "BREVO_API_KEY is not set" };
    if (!from) return { sent: false, reason: "EMAIL_FROM is not set" };
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { email: from },
        to: [{ email: args.to }],
        subject: args.subject,
        htmlContent: args.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { sent: false, reason: `Brevo HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    return { sent: true };
  },
});
