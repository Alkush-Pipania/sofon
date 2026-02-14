package scheduler

import "github.com/google/uuid"

type JobPayload struct {
	MonitorID uuid.UUID
}
