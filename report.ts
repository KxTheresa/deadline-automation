// Shared report types. The agent returns the flagged / noDeadline arrays as JSON
// (see prompts.ts); the scan wraps them with a `generated` timestamp.

export type FlaggedTicket = {
    ticket: string;
    date: string; // YYYY-MM-DD
    type: string;
    confidence: string;
    context: string;
};

export type NoDeadlineTicket = {
    ticket: string;
    reason: string;
};

export type ReportData = {
    generated: string; // "YYYY-MM-DD HH:MM:SS"
    flagged: FlaggedTicket[];
    noDeadline: NoDeadlineTicket[];
};
