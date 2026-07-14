import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { Version3Client } from "jira.js";
import { z } from "zod";
import { consola } from "consola";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SYSTEM_PROMPT } from "./prompts.ts";
import type { ReportData } from "./report.ts";

/** Jira v3 returns `description` as an ADF document; flatten it to plain text. */
function adfToText(node: unknown): string {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(adfToText).join("");
    if (typeof node === "object") {
        const n = node as { type?: string; text?: string; content?: unknown };
        if (n.type === "text" && typeof n.text === "string") return n.text;
        let text = adfToText(n.content);
        if (n.type === "paragraph") text += "\n";
        return text;
    }
    return "";
}

type JiraIssue = {
    key: string;
    summary: string;
    description: string;
    status: string;
    priority: string;
};

function toIssue(issue: any): JiraIssue {
    const fields = issue.fields ?? {};
    return {
        key: issue.key,
        summary: fields.summary ?? "",
        description: adfToText(fields.description).trim(),
        status: fields.status?.name ?? "",
        priority: fields.priority?.name ?? "",
    };
}

export async function runScan() {
    const jiraToken = process.env.JIRA_API_TOKEN;
    const jiraEmail = process.env.JIRA_EMAIL;
    if (!jiraToken || !jiraEmail) {
        consola.error("JIRA_API_TOKEN and JIRA_EMAIL must be set in .env");
        process.exit(1);
    }

    const client = new Version3Client({
        host: "https://kineticsolutions.atlassian.net",
        authentication: {
            basic: {
                email: jiraEmail,
                apiToken: jiraToken,
            },
        },
    });

    const jql = 'filter in ("33742") AND status = "Support 1st line"';
    consola.start("Querying Jira...");
    const result = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
        jql,
        maxResults: 50,
        fields: ["summary", "description", "status", "priority"],
    });
    const issues: JiraIssue[] = (result.issues ?? []).map(toIssue);
    consola.success(`Fetched ${issues.length} ticket(s) from Jira`);

    // getDate MCP tool
    const getDate = tool(
        "getDate",
        "Parses and validates a date string in YYYY-MM-DD format",
        { date: z.string() },
        async (args) => {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(args.date);
            const parsed = match ? new Date(`${args.date}T00:00:00Z`) : null;
            if (parsed && !Number.isNaN(parsed.getTime())) {
                return { content: [{ type: "text", text: args.date }] };
            }
            return { content: [{ type: "text", text: `Invalid date format: ${args.date}` }] };
        },
    );

    const mcpDate = createSdkMcpServer({
        name: "get-date",
        version: "0.0.1",
        tools: [getDate],
    });

    // Run the agent
    const prompt = issues.map((i) => `TICKET: ${i.key}\n${i.description}`).join("\n\n---\n\n");

    consola.start("Running agent...");
    const response = query({
        prompt,
        options: {
            systemPrompt: SYSTEM_PROMPT,
            model: "claude-sonnet-4-6",
            mcpServers: { tools: mcpDate },
            allowedTools: ["mcp__tools__getDate"],
        },
    });

    // The agent's final message is the JSON report.
    let output = "";
    for await (const msg of response) {
        if (msg.type === "assistant") {
            for (const block of msg.message.content) {
                if (block.type === "text" && block.text.trim()) {
                    consola.log(block.text.trim());
                } else if (block.type === "tool_use") {
                    consola.info(`${block.name}`);
                }
            }
        } else if (msg.type === "result" && msg.subtype === "success") {
            output = msg.result;
        }
    }

    // Parse the JSON the agent returned and write it for the dashboard.
    const outputsDir = join(import.meta.dir, "outputs");
    await mkdir(outputsDir, { recursive: true });
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
    const generated = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

    try {
        // Tolerate ```json fences or stray prose around the object.
        const json = output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
        const parsed = JSON.parse(json) as Pick<ReportData, "flagged" | "noDeadline">;
        const report: ReportData = {
            generated,
            flagged: parsed.flagged ?? [],
            noDeadline: parsed.noDeadline ?? [],
        };
        const jsonPath = join(outputsDir, `report_${stamp}.json`);
        await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf-8");
        consola.success(`Wrote ${jsonPath} (${report.flagged.length} flagged, ${report.noDeadline.length} no-deadline)`);
    } catch (err) {
        consola.error(`Agent did not return valid JSON: ${err}`);
    }
}

// Run directly (`bun run index.ts`); when imported by the scheduler this is skipped.
if (import.meta.main) {
    runScan().catch((err) => {
        consola.error(err);
        process.exit(1);
    });
}
