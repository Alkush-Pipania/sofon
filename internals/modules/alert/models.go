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

// ZendutyConfig holds what the alert service needs from a Zenduty plugin.
type ZendutyConfig struct {
	IntegrationURL string `json:"integration_url"`
}

type AlertEvent struct {
	IncidentID           uuid.UUID
	Type                 AlertType
	MonitorID            uuid.UUID
	TeamID               uuid.UUID
	MonitorURL           string
	NotificationChannels []string
	Reason               string
	StatusCode           int
	LatencyMs            int64
	CheckedAt            time.Time
}
