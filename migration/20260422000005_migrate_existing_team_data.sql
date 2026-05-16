-- +goose Up
-- +goose StatementBegin
-- Migrate singleton team data into the new teams table
DO $$
DECLARE
    new_team_id UUID;
BEGIN
    INSERT INTO teams (name, created_at, updated_at)
    SELECT name, created_at, now()
    FROM team
    LIMIT 1
    RETURNING id INTO new_team_id;

    IF new_team_id IS NULL THEN
        INSERT INTO teams (name) VALUES ('My Team') RETURNING id INTO new_team_id;
    END IF;

    INSERT INTO team_members (team_id, user_id, role, is_active, joined_at)
    SELECT new_team_id, id, role, is_active, created_at
    FROM users
    ON CONFLICT (team_id, user_id) DO NOTHING;

    UPDATE monitors SET team_id = new_team_id WHERE team_id IS NULL;

    UPDATE invitations SET team_id = new_team_id WHERE team_id IS NULL;
END;
$$;

ALTER TABLE monitors ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE invitations ALTER COLUMN team_id SET NOT NULL;

DROP TABLE IF EXISTS team;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS team (
    id INT PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'My Team',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_team CHECK (id = 1)
);

INSERT INTO team (id, name, created_at)
SELECT 1, name, created_at FROM teams ORDER BY id LIMIT 1
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, created_at = EXCLUDED.created_at;

INSERT INTO team (id, name) VALUES (1, 'My Team')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE monitors ALTER COLUMN team_id DROP NOT NULL;
UPDATE monitors SET team_id = NULL;

ALTER TABLE invitations ALTER COLUMN team_id DROP NOT NULL;
UPDATE invitations SET team_id = NULL;

DELETE FROM team_members;

DROP TABLE IF EXISTS teams CASCADE;
-- +goose StatementEnd
