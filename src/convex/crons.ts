import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// The engine sweeps every 24 hours for students who enabled auto-apply.
crons.interval("engine-daily", { hours: 24 }, api.engine.engineDaily, {});

export default crons;
