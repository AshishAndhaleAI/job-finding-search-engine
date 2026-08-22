import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Continuous job hunt: the engine sweeps every 2 hours for every student who
// enabled auto-apply (default ON), finds fresh entry-level jobs and applies
// automatically — no per-job approval needed. Already-seen jobs are skipped.
crons.interval("engine-continuous", { hours: 2 }, api.engine.engineDaily, {});

export default crons;
