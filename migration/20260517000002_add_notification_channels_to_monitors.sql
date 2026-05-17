-- +goose Up
ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS notification_channels TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE monitors
    DROP COLUMN IF EXISTS notification_channels;
