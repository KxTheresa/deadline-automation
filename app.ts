// Single entrypoint: serves the dashboard and runs the daily scan scheduler
// together in one long-lived process (`bun run start`).
import { startServer } from "./server.ts";
import { startScheduler } from "./scheduler.ts";

startServer();
startScheduler();
