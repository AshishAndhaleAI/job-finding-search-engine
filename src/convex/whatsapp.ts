import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Send a WhatsApp message via Meta's official WhatsApp Business Cloud API —
 * the most free option: service conversations are free (Meta has been
 * removing even the 1,000/month cap), and setup needs no credit card.
 *
 * Requires two keys (Freebuff Keys tab):
 *   WHATSAPP_ACCESS_TOKEN      – Meta system-user / app access token
 *   WHATSAPP_PHONE_NUMBER_ID   – the business number ID the message is sent from
 *
 * Returns { sent: false, reason } when not configured, so the engine keeps
 * working without it.
 *
 * Note: WhatsApp only lets you message a user freely if they messaged you
 * first (24h window). For the first ever outbound message you must use an
 * approved template ("FirstStep: <count> new jobs matched for you") created
 * in the Meta WhatsApp Manager. This action sends plain text, which works
 * once the conversation is open; swap `text` for `template` if you want to
 * handle cold outbound with a template.
 */
export const sendMessage = action({
  args: {
    to: v.string(), // E.164 format, e.g. "+15551234567"
    text: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token) return { sent: false, reason: "WHATSAPP_ACCESS_TOKEN is not set" };
    if (!phoneNumberId) return { sent: false, reason: "WHATSAPP_PHONE_NUMBER_ID is not set" };
    if (!args.to.startsWith("+")) {
      return { sent: false, reason: "Phone must be in E.164 format, e.g. +15551234567" };
    }
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: args.to,
          type: "text",
          text: { preview_url: false, body: args.text },
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { sent: false, reason: `WhatsApp HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    return { sent: true };
  },
});
