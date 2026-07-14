# deadline-automation

Scans Jira support tickets for customer-stated deadlines using a Claude agent, and shows the results on a dashboard.

## Setup

```bash
bun install
```

Create a `.env` file:

```
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your-jira-token
CLAUDE_CODE_OAUTH_TOKEN=your-claude-token
```

## Usage

```bash
bun run start      # dashboard + daily 8am scheduler in one process
```

Or run the pieces individually:

```bash
bun run scan       # run one scan now -> writes outputs/report_<timestamp>.{md,json}
bun run schedule   # run the scan every morning at 8am
bun run dev        # start the dashboard at http://localhost:3000
```

## Layout

| Path | Purpose |
|------|---------|
| `index.ts` | Fetches tickets from Jira and runs the Claude agent |
| `prompts.ts` | The agent's system prompt |
| `report.ts` | Shared report types |
| `app.ts` | Combined entrypoint (dashboard + scheduler) |
| `scheduler.ts` | Daily 8am scheduler (rrule) |
| `server.ts` | Bun server for the dashboard + API |
| `src/` | React + shadcn/ui dashboard |
| `outputs/` | Generated reports (git-ignored) |
