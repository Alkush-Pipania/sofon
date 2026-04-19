-- name: CreateInvitation :one
INSERT INTO invitations (email, role, token, expires_at, invited_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, role, token, expires_at, accepted_at, invited_by, created_at;

-- name: GetInvitationByToken :one
SELECT id, email, role, token, expires_at, accepted_at, invited_by, created_at
FROM invitations
WHERE token = $1;

-- name: ListInvitations :many
SELECT id, email, role, token, expires_at, accepted_at, invited_by, created_at
FROM invitations
ORDER BY created_at DESC;

-- name: AcceptInvitation :exec
UPDATE invitations SET accepted_at = now() WHERE token = $1;

-- name: DeleteInvitation :exec
DELETE FROM invitations WHERE id = $1;
