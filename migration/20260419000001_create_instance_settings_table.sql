-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS instance_settings (
    id INT PRIMARY KEY DEFAULT 1,
    registrations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO instance_settings (id, registrations_enabled)
VALUES (1, TRUE)
ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS instance_settings;
-- +goose StatementEnd
