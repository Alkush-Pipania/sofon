-- name: CreateUser :one
INSERT INTO users (name, email, password_hash, role)
VALUES ($1, $2, $3, $4)
    RETURNING id;

-- name: GetUserByID :one
SELECT id, name, email, password_hash, monitors_count
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, name, email, password_hash, role, is_active
FROM users
WHERE email = $1;

-- name: ListUsers :many
SELECT id, name, email, role, is_active, created_at
FROM users
ORDER BY created_at ASC;

-- name: IncrementMonitorCount :execrows
UPDATE users
SET monitors_count = monitors_count + 1
WHERE id = $1 AND monitors_count < 10;

-- name: DecrementMonitorCount :exec
UPDATE users
SET monitors_count = GREATEST(monitors_count - 1, 0)
WHERE id = $1;

-- name: HasUsers :one
SELECT EXISTS(SELECT 1 FROM users) AS has_users;

-- name: GetUserActiveStatus :one
SELECT is_active FROM users WHERE id = $1;

-- name: SetUserActive :exec
UPDATE users SET is_active = $1 WHERE id = $2;

-- name: UpdateUserName :exec
UPDATE users SET name = $1 WHERE id = $2;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1 WHERE id = $2;

-- name: GetUserPasswordHash :one
SELECT password_hash FROM users WHERE id = $1;
