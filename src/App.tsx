import { useEffect, useState } from "react";
import { CalendarClock, CircleCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ReportData } from "../report.ts";

type Report = ReportData & { file: string };

const confidenceVariant = (c: string) =>
    c === "high" ? "default" : c === "medium" ? "secondary" : "outline";

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <Card>
            <CardHeader>
                <CardDescription className="flex items-center gap-2">
                    {icon}
                    {label}
                </CardDescription>
                <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
        </Card>
    );
}

export function App() {
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Poll for the latest report so the dashboard updates itself after each scan.
        const load = () =>
            fetch("/api/reports", { cache: "no-store" })
                .then((r) => r.json())
                .then((data: Report[]) => setReport(data[0] ?? null))
                .catch((e) => setError(String(e)));
        load();
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="mx-auto max-w-5xl px-6 py-10">
            <header className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight">Deadline Scan Dashboard</h1>
                <p className="text-muted-foreground text-sm">
                    {report
                        ? `Latest scan: ${report.generated}`
                        : "Customer-stated deadlines detected across support tickets"}
                </p>
            </header>

            {error && <p className="text-destructive">Failed to load reports: {error}</p>}
            {!error && !report && (
                <p className="text-muted-foreground">No reports yet. Run a scan with `bun run scan`.</p>
            )}

            {report && (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Stat
                            icon={<TriangleAlert className="size-4" />}
                            label="Flagged deadlines"
                            value={report.flagged.length}
                        />
                        <Stat
                            icon={<CircleCheck className="size-4" />}
                            label="No deadline"
                            value={report.noDeadline.length}
                        />
                        <Stat
                            icon={<CalendarClock className="size-4" />}
                            label="Tickets scanned"
                            value={report.flagged.length + report.noDeadline.length}
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Flagged Tickets</CardTitle>
                            <CardDescription>Sorted by date, soonest first</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {report.flagged.length === 0 ? (
                                <p className="text-muted-foreground text-sm">None.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ticket</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Confidence</TableHead>
                                            <TableHead>Context</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.flagged.map((f) => (
                                            <TableRow key={f.ticket}>
                                                <TableCell className="font-medium">{f.ticket}</TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums">
                                                    {f.date}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{f.type}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={confidenceVariant(f.confidence)}>
                                                        {f.confidence}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-md">
                                                    {f.context}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>No Deadline Found</CardTitle>
                            <CardDescription>{report.noDeadline.length} ticket(s)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {report.noDeadline.length === 0 ? (
                                <p className="text-muted-foreground text-sm">None.</p>
                            ) : (
                                <ul className="flex flex-col gap-2 text-sm">
                                    {report.noDeadline.map((n) => (
                                        <li key={n.ticket} className="flex gap-2">
                                            <span className="font-medium">{n.ticket}</span>
                                            <span className="text-muted-foreground">{n.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
