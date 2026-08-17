# FirstStep — Automated Job Engine for Freshers

A search engine that finds entry-level jobs worldwide (0 years of experience needed)
and applies to them automatically, notifying the student by email and WhatsApp until
they land a role.

## One-click open

| Platform | File | What it does |
|---|---|---|
| **Windows** | `start.bat` | Double-click → installs deps (first run) → starts the app → opens your browser |
| **macOS / Linux** | `start.sh` | `./start.sh` → same as above |

The app runs at `http://localhost:5173` (or the `PORT` env var if set).

## Features

- **Live job search — 100% free, no API key** — aggregates real entry-level jobs from
  Remotive, Arbeitnow, and RemoteOK, scores them against the student's target roles and
  skills, and keeps the best matches. Falls back to curated demo jobs if the boards are
  unreachable, so the flow always works.
- **Auto-apply engine** — a daily cron runs the engine for every student who enabled
  auto-apply; manual "Run engine now" also available from the dashboard.
- **Email digests (optional)** — Brevo, 300 emails/day free forever, no credit card.
- **WhatsApp digests (optional)** — Meta WhatsApp Business Cloud API, service
  conversations are free.
- **In-app notifications** — always on, no keys needed.
- **Profile & resume** — target roles, skills, location, resume upload, auto-apply toggle.
- **Application tracker** — matched → applied → interview → rejected → offered, with
  filters and links back to each job.

## Stack

Vite + React + TypeScript + Tailwind CSS v4 + Convex (backend/database/auth) + shadcn-style UI.

## Env vars (all optional — the app runs fully in demo/in-app mode without them)

| Key | Purpose | Where to get it |
|---|---|---|
| `BREVO_API_KEY` | Send email digests (Brevo) | https://brevo.com — free plan, verify a sender address |
| `EMAIL_FROM` | Sender address for email digests | Your verified address in the Brevo dashboard |
| `WHATSAPP_ACCESS_TOKEN` | Send WhatsApp digests (Meta) | https://developers.facebook.com → WhatsApp → create app |
| `WHATSAPP_PHONE_NUMBER_ID` | Business number for WhatsApp messages | Same Meta API setup screen |
| `BRAVE_API_KEY` | Optional extra live-job source (boost) | https://brave.com/search/api/ |

In Freebuff, paste these into the **Keys / API keys** tab — never commit real keys.

## Local development

```bash
bun install
bun run dev          # start the app
bun convex dev --once && bun tsc -b --noEmit   # verify backend + types
```

## Note on WhatsApp cold-start

WhatsApp only lets you message a user freely after they've messaged you first
(24-hour window). For the first ever outbound message, create one approved template in
WhatsApp Manager — see the comment in `src/convex/whatsapp.ts`.
