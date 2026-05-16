-- name: AddTeamMember :one
INSERT INTO team_members (team_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING id, team_id, user_id, role, is_active, joined_at;

-- name: GetTeamMembership :one
SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.is_active, tm.joined_at
FROM team_members tm
WHERE tm.team_id = $1 AND tm.user_id = $2;

-- name: ListTeamMembers :many
SELECT u.id, u.name, u.email, tm.role, tm.is_active, u.created_at
FROM team_members tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1
ORDER BY u.created_at ASC;

-- name: SetTeamMemberActive :exec
UPDATE team_members
SET is_active = $3
WHERE team_id = $1 AND user_id = $2;

-- name: UserIsMember :one
SELECT EXISTS(
    SELECT 1 FROM team_members
    WHERE team_id = $1 AND user_id = $2
) AS is_member;
