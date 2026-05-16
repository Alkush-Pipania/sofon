-- +goose Up
-- +goose StatementBegin
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE invitations DROP COLUMN IF EXISTS team_id;
-- +goose StatementEnd
