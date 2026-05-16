-- name: UpsertPlugin :one
INSERT INTO plugins (team_id, plugin_type, enabled, config_enc, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (team_id, plugin_type)
DO UPDATE SET
    enabled    = EXCLUDED.enabled,
    config_enc = EXCLUDED.config_enc,
    updated_at = now()
RETURNING *;

-- name: GetPlugin :one
SELECT * FROM plugins
WHERE team_id = $1 AND plugin_type = $2;

-- name: ListPlugins :many
SELECT * FROM plugins
WHERE team_id = $1
ORDER BY plugin_type;

-- name: DeletePlugin :exec
DELETE FROM plugins
WHERE team_id = $1 AND plugin_type = $2;
