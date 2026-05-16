-- +goose Up
-- +goose StatementBegin
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE monitors DROP COLUMN IF EXISTS team_id;
-- +goose StatementEnd
