-- name: GetRegistrationsEnabled :one
SELECT registrations_enabled FROM instance_settings WHERE id = 1;

-- name: SetRegistrationsEnabled :exec
UPDATE instance_settings SET registrations_enabled = $1 WHERE id = 1;
