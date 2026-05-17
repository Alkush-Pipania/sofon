-- +goose Up
ALTER TABLE monitors
    ADD COLUMN notification_channels TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE monitors
    DROP COLUMN notification_channels;
