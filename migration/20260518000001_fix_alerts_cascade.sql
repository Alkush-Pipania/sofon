-- +goose Up
ALTER TABLE alerts
    DROP CONSTRAINT alerts_incident_id_fkey,
    ADD CONSTRAINT alerts_incident_id_fkey
        FOREIGN KEY (incident_id) REFERENCES monitor_incidents(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE alerts
    DROP CONSTRAINT alerts_incident_id_fkey,
    ADD CONSTRAINT alerts_incident_id_fkey
        FOREIGN KEY (incident_id) REFERENCES monitor_incidents(id);
