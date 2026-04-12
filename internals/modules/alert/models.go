package alert

import (
	"time"

	"github.com/google/uuid"
)

type AlertType string

const (
	AlertTypeDown      AlertType = "DOWN"
	AlertTypeRecovered AlertType = "RECOVERED"
)

type AlertEvent struct {
	IncidentID uuid.UUID
	Type       AlertType
	MonitorID  uuid.UUID
	MonitorURL string
	AlertEmail string
	Reason     string
	StatusCode int
	LatencyMs  int64
	CheckedAt  time.Time
}
