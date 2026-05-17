package monitor

import (
	"time"

	"github.com/google/uuid"
)

type CreateMonitor struct {
	TeamID               uuid.UUID
	UserID               uuid.UUID
	Url                  string
	IntervalSec          int32
	TimeoutSec           int32
	LatencyThresholdMs   *int32
	ExpectedStatus       *int32
	NotificationChannels []string
}

type Monitor struct {
	ID                   uuid.UUID
	TeamID               uuid.UUID
	UserID               uuid.UUID
	Url                  string
	IntervalSec          int32
	TimeoutSec           int32
	LatencyThresholdMs   *int32
	ExpectedStatus       *int32
	Enabled              bool
	CreatedAt            time.Time
	IsDown               bool
	NotificationChannels []string
}

type Cursor struct {
	CreatedAt time.Time
	MonitorID string
}

type ListMonitorsOptions struct {
	Limit  int32
	Cursor *Cursor
}

type ListMonitorsPage struct {
	Monitors   []Monitor
	HasMore    bool
	NextCursor *string
	Limit      int32
}

type MonitorRecord struct {
	ID                 uuid.UUID
	UserID             uuid.UUID
	Url                string
	IntervalSec        time.Duration
	TimeoutSec         time.Duration
	LatencyThresholdMS time.Duration
	ExpectedStatus     int
	Enabled            bool
	Disabled           bool
}
