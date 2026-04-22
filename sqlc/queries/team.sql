-- name: CreateTeam :one
INSERT INTO teams (name)
VALUES ($1)
RETURNING id, name, created_at, updated_at;

-- name: GetTeamByID :one
SELECT id, name, created_at, updated_at
FROM teams
WHERE id = $1;

-- name: ListTeamsByUserID :many
SELECT t.id, t.name, t.created_at, t.updated_at
FROM teams t
JOIN team_members tm ON tm.team_id = t.id
WHERE tm.user_id = $1
ORDER BY t.created_at ASC;

-- name: UpdateTeamName :exec
UPDATE teams SET name = $2, updated_at = now()
WHERE id = $1;
