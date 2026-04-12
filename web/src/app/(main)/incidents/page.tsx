"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

type IncidentStatus = "all" | "active" | "resolved";

interface LatestAlert {
	status?: string;
	email?: string;
	sent_at?: string | null;
}

interface Incident {
	id: string;
	monitor_id: string;
	monitor_url: string;
	start_time: string;
	end_time?: string | null;
	alerted: boolean;
	http_status: number;
	latency_ms: number;
	created_at: string;
	is_active: boolean;
	duration_sec: number;
	latest_alert?: LatestAlert | null;
}

interface IncidentListPayload {
	limit: number;
	has_more: boolean;
	next_cursor?: string | null;
	incidents: Incident[];
}

interface IncidentListResponse {
	success: boolean;
	message: string;
	data: IncidentListPayload;
}

interface AppliedFilters {
	status: IncidentStatus;
	query: string;
	fromDate: string;
	toDate: string;
}

const DEFAULT_FILTERS: AppliedFilters = {
	status: "all",
	query: "",
	fromDate: "",
	toDate: "",
};

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return `${h}h ${m}m`;
}

function toISODateStart(date: string): string {
	return new Date(`${date}T00:00:00`).toISOString();
}

function toISODateEnd(date: string): string {
	return new Date(`${date}T23:59:59`).toISOString();
}

export default function IncidentsPage() {
	const [incidents, setIncidents] = useState<Incident[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [draftFilters, setDraftFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
	const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);

	const [cursor, setCursor] = useState<string | null>(null);
	const [history, setHistory] = useState<string[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);

	const fetchIncidents = async (cursorValue: string | null, filters: AppliedFilters) => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams();
			params.set("limit", "20");
			params.set("status", filters.status);
			if (filters.query.trim()) params.set("q", filters.query.trim());
			if (filters.fromDate) params.set("from", toISODateStart(filters.fromDate));
			if (filters.toDate) params.set("to", toISODateEnd(filters.toDate));
			if (cursorValue) params.set("cursor", cursorValue);

			const res = await get<IncidentListResponse>(`${ENDPOINTS.INCIDENTS.LIST}?${params.toString()}`);

			setIncidents(res.data.incidents ?? []);
			setHasMore(res.data.has_more ?? false);
			setNextCursor(res.data.next_cursor ?? null);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to fetch incidents";
			setError(msg);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchIncidents(cursor, appliedFilters);
	}, [cursor, appliedFilters]);

	const currentActive = useMemo(() => incidents.filter((i) => i.is_active).length, [incidents]);

	const onApplyFilters = () => {
		setAppliedFilters(draftFilters);
		setCursor(null);
		setHistory([]);
	};

	const onClearFilters = () => {
		setDraftFilters(DEFAULT_FILTERS);
		setAppliedFilters(DEFAULT_FILTERS);
		setCursor(null);
		setHistory([]);
	};

	const onNext = () => {
		if (!nextCursor) return;
		setHistory((prev) => [...prev, cursor ?? ""]);
		setCursor(nextCursor);
	};

	const onPrev = () => {
		setHistory((prev) => {
			if (prev.length === 0) return prev;
			const copy = [...prev];
			const previousCursor = copy.pop() ?? "";
			setCursor(previousCursor === "" ? null : previousCursor);
			return copy;
		});
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
					<p className="text-sm text-muted-foreground">Filter outages and navigate incident history with cursors.</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => fetchIncidents(cursor, appliedFilters)}
					disabled={loading}
					className="gap-1.5"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Filters</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-3 md:grid-cols-4">
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">Status</label>
							<select
								value={draftFilters.status}
								onChange={(e) => setDraftFilters((p) => ({ ...p, status: e.target.value as IncidentStatus }))}
								className="h-9 w-full rounded-md border bg-background px-3 text-sm"
							>
								<option value="all">All</option>
								<option value="active">Active</option>
								<option value="resolved">Resolved</option>
							</select>
						</div>
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">Monitor URL contains</label>
							<Input
								placeholder="api.example.com"
								value={draftFilters.query}
								onChange={(e) => setDraftFilters((p) => ({ ...p, query: e.target.value }))}
							/>
						</div>
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">From date</label>
							<Input
								type="date"
								value={draftFilters.fromDate}
								onChange={(e) => setDraftFilters((p) => ({ ...p, fromDate: e.target.value }))}
							/>
						</div>
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">To date</label>
							<Input
								type="date"
								value={draftFilters.toDate}
								onChange={(e) => setDraftFilters((p) => ({ ...p, toDate: e.target.value }))}
							/>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button size="sm" onClick={onApplyFilters}>Apply</Button>
						<Button size="sm" variant="outline" onClick={onClearFilters}>Clear</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">Incidents On Page</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-semibold">{incidents.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">Active On Page</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-semibold text-destructive">{currentActive}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">Resolved On Page</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-semibold">{Math.max(incidents.length - currentActive, 0)}</div>
					</CardContent>
				</Card>
			</div>

			{loading ? (
				<div className="flex h-56 items-center justify-center gap-2 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
					Loading incidents...
				</div>
			) : error ? (
				<div className="flex h-56 flex-col items-center justify-center gap-2 text-destructive">
					<AlertCircle className="h-5 w-5" />
					<p>{error}</p>
				</div>
			) : (
				<>
					<div className="rounded-xl border bg-card">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead>Monitor</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Started</TableHead>
									<TableHead>Duration</TableHead>
									<TableHead>HTTP</TableHead>
									<TableHead>Alert</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{incidents.length === 0 ? (
									<TableRow>
										<TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
											No incidents found.
										</TableCell>
									</TableRow>
								) : (
									incidents.map((incident) => (
										<TableRow key={incident.id} className="group">
											<TableCell className="font-medium">
												<Link href={`/incidents/${incident.id}`} className="hover:underline">
													{incident.monitor_url}
												</Link>
											</TableCell>
											<TableCell>
												{incident.is_active ? (
													<Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600">
														Active
													</Badge>
												) : (
													<Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
														Resolved
													</Badge>
												)}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{new Date(incident.start_time).toLocaleString()}
											</TableCell>
											<TableCell>{formatDuration(incident.duration_sec)}</TableCell>
											<TableCell>{incident.http_status}</TableCell>
											<TableCell>{incident.latest_alert?.status || "not_sent"}</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					<div className="flex items-center justify-end gap-2">
						<Button variant="outline" size="sm" onClick={onPrev} disabled={history.length === 0 || loading}>
							<ChevronLeft className="mr-1 h-4 w-4" />
							Prev
						</Button>
						<Button variant="outline" size="sm" onClick={onNext} disabled={!hasMore || !nextCursor || loading}>
							Next
							<ChevronRight className="ml-1 h-4 w-4" />
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
