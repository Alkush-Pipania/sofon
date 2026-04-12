"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

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

interface IncidentDetailResponse {
	success: boolean;
	message: string;
	data: Incident;
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return `${h}h ${m}m`;
}

export default function IncidentDetailPage() {
	const params = useParams<{ incidentID: string }>();
	const incidentID = String(params.incidentID || "");

	const [incident, setIncident] = useState<Incident | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await get<IncidentDetailResponse>(ENDPOINTS.INCIDENTS.GET(incidentID));
				setIncident(res.data);
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : "Failed to load incident");
			} finally {
				setLoading(false);
			}
		};

		if (incidentID) run();
	}, [incidentID]);

	if (loading) {
		return (
			<div className="flex h-56 items-center justify-center gap-2 text-muted-foreground">
				<Loader2 className="h-5 w-5 animate-spin" />
				Loading incident details...
			</div>
		);
	}

	if (error || !incident) {
		return (
			<div className="space-y-4">
				<Button asChild variant="outline" size="sm" className="gap-1.5">
					<Link href="/incidents">
						<ArrowLeft className="h-4 w-4" />
						Back to incidents
					</Link>
				</Button>
				<div className="flex h-56 flex-col items-center justify-center gap-2 text-destructive">
					<AlertCircle className="h-5 w-5" />
					<p>{error || "Incident not found"}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Button asChild variant="outline" size="sm" className="gap-1.5">
				<Link href="/incidents">
					<ArrowLeft className="h-4 w-4" />
					Back to incidents
				</Link>
			</Button>

			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Incident {incident.id.slice(0, 8)}</h1>
					<p className="text-sm text-muted-foreground">Monitor: {incident.monitor_url}</p>
				</div>
				{incident.is_active ? (
					<Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600">
						Active
					</Badge>
				) : (
					<Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
						Resolved
					</Badge>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Timeline</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Started</span>
							<span>{new Date(incident.start_time).toLocaleString()}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Ended</span>
							<span>{incident.end_time ? new Date(incident.end_time).toLocaleString() : "Ongoing"}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Duration</span>
							<span>{formatDuration(incident.duration_sec)}</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Check Snapshot</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">HTTP status</span>
							<span>{incident.http_status}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Latency</span>
							<span>{incident.latency_ms} ms</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Alerted</span>
							<span>{incident.alerted ? "Yes" : "No"}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Alert Delivery</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Status</span>
						<span>{incident.latest_alert?.status || "not_sent"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Recipient</span>
						<span>{incident.latest_alert?.email || "N/A"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Sent at</span>
						<span>
							{incident.latest_alert?.sent_at
								? new Date(incident.latest_alert.sent_at).toLocaleString()
								: "N/A"}
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
