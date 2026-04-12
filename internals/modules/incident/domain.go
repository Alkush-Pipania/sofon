package incident

import (
	"time"

	"github.com/google/uuid"
)

type Incident struct {
	ID          string
	MonitorID   string
	MonitorURL  string
	StartTime   time.Time
	EndTime     *time.Time
	Alerted     bool
	HTTPStatus  int32
	LatencyMs   int32
	CreatedAt   time.Time
	IsActive    bool
	DurationSec int64
	AlertStatus string
	AlertEmail  string
	AlertSentAt *time.Time
}

type Cursor struct {
	StartTime  time.Time
	IncidentID string
}

type ListFilters struct {
	Status    string
	Query     string
	MonitorID *uuid.UUID
	From      *time.Time
	To        *time.Time
}

type ListIncidentsOptions struct {
	Limit   int32
	Cursor  *Cursor
	Filters ListFilters
}

type ListIncidentsPage struct {
	Incidents  []Incident
	HasMore    bool
	NextCursor *string
	Applied    ListFilters
	Limit      int32
}
