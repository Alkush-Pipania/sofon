-- name: CreateMonitor :one
INSERT INTO monitors (
    user_id,
    team_id,
    url,
    interval_sec,
    timeout_sec,
    latency_threshold_ms,
    expected_status,
    alert_email,
    notification_channels
) VALUES (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             $8,
             $9
         )
    RETURNING id;

-- name: GetMonitorByID :one
SELECT id, user_id, team_id, url, alert_email, notification_channels, interval_sec, timeout_sec, latency_threshold_ms, expected_status, enabled
FROM monitors
WHERE id = $1;

-- name: GetMonitorByTeamID :one
SELECT id, user_id, team_id, url, alert_email, notification_channels, interval_sec, timeout_sec, latency_threshold_ms, expected_status, enabled
FROM monitors
WHERE id = $1 AND team_id = $2;

-- name: ListMonitorsByTeamCursor :many
SELECT id, user_id, team_id, url, alert_email, notification_channels, interval_sec, timeout_sec,
       latency_threshold_ms, expected_status, enabled, created_at,
       EXISTS (
           SELECT 1 FROM monitor_incidents mi
           WHERE mi.monitor_id = monitors.id AND mi.end_time IS NULL
       ) AS is_down
FROM monitors
WHERE team_id = $1
  AND (
    $2::timestamptz IS NULL
    OR (created_at, id) < ($2::timestamptz, $3::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT $4;

-- name: UpdateMonitorStatus :execrows
UPDATE monitors
SET enabled = $2
WHERE id = $1 AND team_id = $3;

-- name: DeleteMonitor :execrows
DELETE FROM monitors
WHERE id = $1 AND team_id = $2;
