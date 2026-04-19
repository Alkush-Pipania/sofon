-- name: GetTeam :one
SELECT id, name FROM team WHERE id = 1;

-- name: UpdateTeamName :exec
UPDATE team SET name = $1 WHERE id = 1;
