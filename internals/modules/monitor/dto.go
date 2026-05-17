package monitor

type CreateMonitorRequest struct {
	Url                  string   `json:"url" validate:"required,url"`
	IntervalSec          int32    `json:"interval_sec" validate:"required,gte=60"`
	TimeoutSec           int32    `json:"timeout_sec" validate:"required,gte=120"`
	LatencyThresholdMs   *int32   `json:"latency_threshold_ms"`
	ExpectedStatus       *int32   `json:"expected_status"`
	NotificationChannels []string `json:"notification_channels"`
}

type CreateMonitorResponse struct {
	MonitorID string `json:"monitor_id"`
}

type GetMonitorResponse struct {
	ID                   string   `json:"id"`
	Url                  string   `json:"url"`
	IntervalSec          int32    `json:"interval_sec"`
	TimeoutSec           int32    `json:"timeout_sec"`
	LatencyThresholdMs   *int32   `json:"latency_threshold_ms"`
	ExpectedStatus       *int32   `json:"expected_status"`
	Enabled              bool     `json:"enabled"`
	IsDown               bool     `json:"is_down"`
	NotificationChannels []string `json:"notification_channels"`
}

type ListMonitorsResponse struct {
	Limit      int32                `json:"limit"`
	HasMore    bool                 `json:"has_more"`
	NextCursor *string              `json:"next_cursor,omitempty"`
	Monitors   []GetMonitorResponse `json:"monitors"`
}

type UpdateMonitorStatusRequest struct {
	Enable *bool `json:"enable" validate:"required"`
}
