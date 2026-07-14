import { RRule } from "rrule";
import { consola } from "consola";
import { runScan } from "./index.ts";

// Every morning at 8:00 (local wall-clock time).
const HOUR = Number(process.env.SCAN_HOUR ?? 8);
const MINUTE = Number(process.env.SCAN_MINUTE ?? 0);

// rrule works in "floating" UTC time: it reads/writes a Date's UTC fields and
// treats them as wall-clock. These helpers bridge between a real local instant
// and that floating representation so "8am" means 8am in the machine's zone.
const toFloating = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
const fromFloating = (d: Date) =>
    new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0);

const rule = new RRule({
    freq: RRule.DAILY,
    byhour: HOUR,
    byminute: MINUTE,
    bysecond: 0,
    dtstart: new Date(Date.UTC(2024, 0, 1, HOUR, MINUTE, 0)),
});

function nextRun(): Date {
    const next = rule.after(toFloating(new Date()));
    if (!next) throw new Error("rrule produced no next occurrence");
    return fromFloating(next);
}

function scheduleNext() {
    const next = nextRun();
    const delay = next.getTime() - Date.now();
    consola.info(`Next scan scheduled for ${next.toLocaleString()}`);

    setTimeout(async () => {
        consola.start("Starting scheduled scan");
        try {
            await runScan();
        } catch (err) {
            consola.error(err);
        }
        scheduleNext(); // re-arm for tomorrow
    }, delay);
}

consola.ready(`Daily scan scheduler started (${String(HOUR).padStart(2, "0")}:${String(MINUTE).padStart(2, "0")})`);

// Optionally run once on startup (useful for testing / first boot).
if (["1", "true", "yes"].includes((process.env.SCAN_ON_START ?? "").toLowerCase())) {
    runScan().catch((err) => consola.error(err));
}

scheduleNext();
