import { serve } from "bun";
import { consola } from "consola";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import index from "./src/index.html";
import type { ReportData } from "./report.ts";

const OUTPUTS_DIR = join(import.meta.dir, "outputs");

/** Read every outputs/*.json report, newest first (filenames are timestamped). */
async function loadReports(): Promise<Array<ReportData & { file: string }>> {
    let files: string[];
    try {
        files = (await readdir(OUTPUTS_DIR)).filter((f) => f.endsWith(".json"));
    } catch {
        return []; // outputs/ doesn't exist yet
    }
    files.sort().reverse();

    const reports = await Promise.all(
        files.map(async (file) => {
            try {
                const data = JSON.parse(await readFile(join(OUTPUTS_DIR, file), "utf-8")) as ReportData;
                return { ...data, file };
            } catch {
                return null;
            }
        }),
    );
    return reports.filter((r): r is ReportData & { file: string } => r !== null);
}

export function startServer() {
    const server = serve({
        port: Number(process.env.PORT ?? 3000),
        development: true,
        routes: {
            "/": index,
            "/api/reports": async () => Response.json(await loadReports()),
        },
    });
    consola.ready(`Dashboard running at ${server.url}`);
    return server;
}

// Run directly (`bun run server.ts`); when imported by app.ts this is skipped.
if (import.meta.main) startServer();
