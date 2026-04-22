-- name: CreateMonitor :one
INSERT INTO monitors (
    user_id,
    team_id,
    url,
    interval_sec,
    timeout_sec,
    latency_threshold_ms,
    expected_status,
    alert_email
) VALUES (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             $8
         )
    RETURNING id;

-- name: GetMonitorByID :one
SELECT id, user_id, team_id, url, alert_email, interval_sec, timeout_sec, latency_threshold_ms, expected_status, enabled
FROM monitors
WHERE id = $1;

-- name: GetMonitorByTeamID :one
SELECT id, user_id, team_id, url, alert_email, interval_sec, timeout_sec, latency_threshold_ms, expected_status, enabled
FROM monitors
WHERE id = $1 AND team_id = $2;

-- name: GetAllMonitorsByTeamID :many
SELECT id, user_id, team_id, url, alert_email, interval_sec, timeout_sec, latency_threshold_ms, expected_status, enabled
FROM monitors
WHERE team_id = $1
ORDER BY updated_at
    LIMIT $2
OFFSET $3;

-- name: UpdateMonitorStatus :execrows
UPDATE monitors
SET enabled = $2
WHERE id = $1 AND team_id = $3;

-- name: DeleteMonitor :execrows
DELETE FROM monitors
WHERE id = $1 AND team_id = $2;
