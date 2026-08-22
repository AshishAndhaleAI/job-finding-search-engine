import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Continuous job hunt: the engine sweeps every hour for every student who
// enabled auto-apply (default ON), finds fresh entry-level jobs, sends real
// application emails where the posting accepts them, and pre-fills the rest
// for one-click submission.
crons.interval("engine-continuous", { minutes: 60 }, api.engine.engineDaily, {});

export default crons;
