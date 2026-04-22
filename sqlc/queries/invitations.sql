-- name: CreateInvitation :one
INSERT INTO invitations (team_id, email, role, token, expires_at, invited_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, team_id, email, role, token, expires_at, accepted_at, invited_by, created_at;

-- name: GetInvitationByToken :one
SELECT id, team_id, email, role, token, expires_at, accepted_at, invited_by, created_at
FROM invitations
WHERE token = $1;

-- name: ListInvitations :many
SELECT id, team_id, email, role, token, expires_at, accepted_at, invited_by, created_at
FROM invitations
WHERE team_id = $1 AND accepted_at IS NULL
ORDER BY created_at DESC;

-- name: AcceptInvitation :exec
UPDATE invitations SET accepted_at = now() WHERE token = $1;

-- name: DeleteInvitation :exec
DELETE FROM invitations WHERE id = $1 AND team_id = $2;
