import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Briefcase,
  CheckCircle2,
  FileText,
  Globe2,
  MailCheck,
  Radar,
  Rocket,
  Search,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";

const AUTH_URL = "/auth?returnTo=%2Fapp";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600 shadow-lg shadow-cyan-500/20">
        <Radar className="size-5 text-slate-950" />
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">
          First<span className="text-primary">Step</span>
        </span>
      )}
    </span>
  );
}

function RadarVisual() {
  const blips = [
    { top: "22%", left: "30%", delay: "0s", label: "Data Analyst — London" },
    { top: "64%", left: "68%", delay: "0.9s", label: "Support Associate — Remote" },
    { top: "70%", left: "26%", delay: "1.7s", label: "QA Engineer — Bengaluru" },
    { top: "30%", left: "66%", delay: "2.4s", label: "Frontend Dev — Remote" },
  ];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      {/* radar */}
      <div className="absolute inset-0 rounded-full border border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
      <div className="absolute inset-[12%] rounded-full border border-primary/15" />
      <div className="absolute inset-[24%] rounded-full border border-primary/15" />
      <div className="absolute inset-[36%] rounded-full border border-primary/15" />
      <div className="absolute inset-[6%] rounded-full border border-primary/5" />
      {/* sweep */}
      <div className="radar-sweep absolute inset-[6%] overflow-hidden rounded-full">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(34,211,238,0.35), transparent 60deg, transparent 360deg)",
          }}
        />
      </div>
      {/* crosshair lines */}
      <div className="absolute inset-[6%] rounded-full">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-primary/10" />
        <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 bg-primary/10" />
      </div>
      {/* blips */}
      {blips.map((b, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ top: b.top, left: b.left }}
        >
          <span
            className="sonar-ring absolute inset-0 rounded-full bg-accent/60"
            style={{ animationDelay: b.delay }}
          />
          <span className="relative block size-2.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
        </div>
      ))}
      {/* center */}
      <div className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_24px_6px_rgba(34,211,238,0.5)]" />

      {/* floating cards */}
      <motion.div
        className="float-y absolute -right-2 top-[8%] w-56 rounded-xl border border-border bg-card/90 p-3 shadow-xl backdrop-blur sm:right-[-14%]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-accent" />
          <span className="text-xs font-semibold">12 applications submitted</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">while you slept ☕</p>
      </motion.div>
      <motion.div
        className="float-y absolute -left-2 top-[42%] w-52 rounded-xl border border-border bg-card/90 p-3 shadow-xl backdrop-blur sm:left-[-14%]"
        style={{ animationDelay: "1.4s" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-primary" />
          <span className="text-xs font-semibold">Interview invite</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">GrowthHive · SDR</p>
      </motion.div>
      <motion.div
        className="float-y absolute bottom-[4%] left-1/2 w-48 -translate-x-1/2 rounded-xl border border-border bg-card/90 p-3 shadow-xl backdrop-blur"
        style={{ animationDelay: "2.6s" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <MailCheck className="size-4 text-accent" />
          <span className="text-xs font-semibold">Email digest sent</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">6 new matches for you</p>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="FirstStep home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to={AUTH_URL}>Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={AUTH_URL}>
                Launch dashboard <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="radar-grid relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Built for freshers with 0 years of experience
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Your job search,
              <br />
              running on{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                autopilot
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              FirstStep is the job-hunting engine for students. Share your profile and resume
              once — it searches entry-level jobs worldwide, applies for you, and emails you
              every update until you land your first role.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" asChild>
                <Link to={AUTH_URL}>
                  Start applying free <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how">See how it works</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-accent" /> No experience required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-accent" /> Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-accent" /> Runs 24/7
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <RadarVisual />
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            { value: "10,000+", label: "applications submitted" },
            { value: "20+", label: "countries covered" },
            { value: "0 yrs", label: "experience required" },
            { value: "24/7", label: "engine uptime" },
          ].map((s, i) => (
            <motion.div key={s.label} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
              <p className="font-display text-3xl font-bold text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps to your first job
          </h2>
          <p className="mt-4 text-muted-foreground">
            You set it up once. The engine does the legwork from there — every single day.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: UserRound,
              step: "01",
              title: "Build your profile",
              body: "Tell us your target roles, skills, location, and upload your resume. That's all the data the engine needs.",
            },
            {
              icon: Search,
              step: "02",
              title: "Engine searches & applies",
              body: "Every day it scans job boards worldwide for entry-level roles that match you, then submits applications on your behalf.",
            },
            {
              icon: BellRing,
              step: "03",
              title: "Get notified by email",
              body: "Every application, interview invite, and offer lands in your inbox instantly — until the day you accept a job.",
            },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.12 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <s.icon className="size-5" />
                </span>
                <span className="font-display text-4xl font-bold text-border/80">{s.step}</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="radar-grid border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Features</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a fresher needs, automated
            </h2>
          </motion.div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Globe2, title: "Worldwide coverage", body: "Entry-level openings from 20+ countries, matched to your location and remote preferences." },
              { icon: Zap, title: "Zero-experience matching", body: "The engine only targets roles explicitly open to freshers — no 3-year-experience bait-and-switch." },
              { icon: MailCheck, title: "Email digests", body: "Transactional emails the moment applications go out, interviews arrive, or offers land." },
              { icon: Briefcase, title: "Application tracker", body: "Every submission tracked: matched → applied → interview → offer, with one-click status updates." },
              { icon: FileText, title: "Resume-ready pipeline", body: "Upload your resume once; the engine attaches it to every application it submits." },
              { icon: Rocket, title: "Keeps going till you win", body: "A daily cron keeps searching and applying — nonstop — until you mark yourself hired." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-10 text-center sm:p-16"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.25),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(52,211,153,0.2),transparent_40%)]" />
          <h2 className="relative font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Your first job is closer than you think.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
            Stop refreshing job boards. Let the engine apply while you focus on your studies,
            your projects, and your life.
          </p>
          <div className="relative mt-8 flex justify-center">
            <Button size="lg" asChild>
              <Link to={AUTH_URL}>
                Create your free profile <ArrowRight />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <motion.div {...fadeUp} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Common questions</h2>
        </motion.div>
        <div className="mt-10 space-y-4">
          {[
            { q: "Is FirstStep really free?", a: "The core engine is free to use while we're in early access. Add your own search API key (optional) to unlock live worldwide job matching." },
            { q: "Do I need any work experience?", a: "No. FirstStep only matches roles that are explicitly entry-level, fresher, or open to 0 years of experience." },
            { q: "What do I need to provide?", a: "Just your email, target roles, skills, preferred location, and a resume. Everything is stored securely in your own workspace." },
            { q: "How does the email notification work?", a: "Enable email digests in your profile and the engine emails you the moment applications are submitted or interviews/offers come in." },
          ].map((f, i) => (
            <motion.div
              key={f.q}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="font-display text-sm font-semibold">{f.q}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FirstStep · Apply to jobs on autopilot
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to={AUTH_URL} className="transition-colors hover:text-foreground">Sign in</Link>
            <Link to={AUTH_URL} className="transition-colors hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
