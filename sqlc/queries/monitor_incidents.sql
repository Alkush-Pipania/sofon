-- name: CreateMonitorIncident :one
INSERT INTO monitor_incidents (monitor_id, start_time, alerted, http_status, latency_ms)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: GetMonitorIncidentByID :one
SELECT id, monitor_id, start_time, end_time, alerted, http_status, latency_ms, created_at
FROM monitor_incidents
WHERE id = $1;

-- name: CloseMonitorIncident :one
UPDATE monitor_incidents
SET end_time = $2
WHERE monitor_id = $1 AND end_time IS NULL
RETURNING id;

-- name: ListIncidentsByTeamCursor :many
SELECT
    mi.id,
    mi.monitor_id,
    m.url AS monitor_url,
    mi.start_time,
    mi.end_time,
    mi.alerted,
    mi.http_status,
    mi.latency_ms,
    mi.created_at,
    (mi.end_time IS NULL)::BOOLEAN AS is_active,
    EXTRACT(EPOCH FROM (COALESCE(mi.end_time, now()) - mi.start_time))::BIGINT AS duration_sec,
    COALESCE(a.status, '') AS alert_status,
    COALESCE(a.alert_email, '') AS alert_email,
    a.sent_at AS alert_sent_at
FROM monitor_incidents mi
JOIN monitors m ON m.id = mi.monitor_id
LEFT JOIN LATERAL (
    SELECT status, alert_email, sent_at
    FROM alerts
    WHERE incident_id = mi.id
    ORDER BY created_at DESC
    LIMIT 1
) a ON true
WHERE m.team_id = $1
  AND (
    $2::text = 'all'
        OR ($2::text = 'active' AND mi.end_time IS NULL)
        OR ($2::text = 'resolved' AND mi.end_time IS NOT NULL)
    )
  AND ($3::timestamptz IS NULL OR mi.start_time >= $3::timestamptz)
  AND ($4::timestamptz IS NULL OR mi.start_time <= $4::timestamptz)
  AND ($5::text = '' OR m.url ILIKE ('%' || $5 || '%'))
  AND ($6::uuid IS NULL OR mi.monitor_id = $6::uuid)
  AND (
    $7::timestamptz IS NULL
        OR (mi.start_time, mi.id) < ($7::timestamptz, $8::uuid)
    )
ORDER BY mi.start_time DESC, mi.id DESC
LIMIT $9;

-- name: GetIncidentByIDAndTeamID :one
SELECT
    mi.id,
    mi.monitor_id,
    m.url AS monitor_url,
    mi.start_time,
    mi.end_time,
    mi.alerted,
    mi.http_status,
    mi.latency_ms,
    mi.created_at,
    (mi.end_time IS NULL)::BOOLEAN AS is_active,
    EXTRACT(EPOCH FROM (COALESCE(mi.end_time, now()) - mi.start_time))::BIGINT AS duration_sec,
    COALESCE(a.status, '') AS alert_status,
    COALESCE(a.alert_email, '') AS alert_email,
    a.sent_at AS alert_sent_at
FROM monitor_incidents mi
JOIN monitors m ON m.id = mi.monitor_id
LEFT JOIN LATERAL (
    SELECT status, alert_email, sent_at
    FROM alerts
    WHERE incident_id = mi.id
    ORDER BY created_at DESC
    LIMIT 1
) a ON true
WHERE mi.id = $1 AND m.team_id = $2;
