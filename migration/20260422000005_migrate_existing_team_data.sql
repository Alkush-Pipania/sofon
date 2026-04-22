-- Migrate singleton team data into the new teams table
DO $$
DECLARE
    new_team_id UUID;
BEGIN
    -- Insert the singleton team into new teams table
    INSERT INTO teams (name, created_at, updated_at)
    SELECT name, created_at, now()
    FROM team
    LIMIT 1
    RETURNING id INTO new_team_id;

    -- If no old team row, create a default
    IF new_team_id IS NULL THEN
        INSERT INTO teams (name) VALUES ('My Team') RETURNING id INTO new_team_id;
    END IF;

    -- Migrate all users into team_members using their current global role
    INSERT INTO team_members (team_id, user_id, role, is_active, joined_at)
    SELECT new_team_id, id, role, is_active, created_at
    FROM users
    ON CONFLICT (team_id, user_id) DO NOTHING;

    -- Backfill monitors.team_id
    UPDATE monitors SET team_id = new_team_id WHERE team_id IS NULL;

    -- Backfill invitations.team_id
    UPDATE invitations SET team_id = new_team_id WHERE team_id IS NULL;
END;
$$;

-- Now enforce NOT NULL
ALTER TABLE monitors ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE invitations ALTER COLUMN team_id SET NOT NULL;

-- Drop old singleton team table
DROP TABLE IF EXISTS team;
