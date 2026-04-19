-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS team (
    id INT PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'My Team',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_team CHECK (id = 1)
);

INSERT INTO team (id, name) VALUES (1, 'My Team') ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS team;
-- +goose StatementEnd
