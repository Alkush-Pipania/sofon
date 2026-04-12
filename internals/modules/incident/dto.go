package incident

type LatestAlertResponse struct {
	Status string  `json:"status,omitempty"`
	Email  string  `json:"email,omitempty"`
	SentAt *string `json:"sent_at,omitempty"`
}

type IncidentResponse struct {
	ID          string               `json:"id"`
	MonitorID   string               `json:"monitor_id"`
	MonitorURL  string               `json:"monitor_url"`
	StartTime   string               `json:"start_time"`
	EndTime     *string              `json:"end_time,omitempty"`
	Alerted     bool                 `json:"alerted"`
	HTTPStatus  int32                `json:"http_status"`
	LatencyMs   int32                `json:"latency_ms"`
	CreatedAt   string               `json:"created_at"`
	IsActive    bool                 `json:"is_active"`
	DurationSec int64                `json:"duration_sec"`
	LatestAlert *LatestAlertResponse `json:"latest_alert,omitempty"`
}

type ListIncidentsResponse struct {
	Limit          int32              `json:"limit"`
	HasMore        bool               `json:"has_more"`
	NextCursor     *string            `json:"next_cursor,omitempty"`
	AppliedFilters AppliedFilters     `json:"applied_filters"`
	Incidents      []IncidentResponse `json:"incidents"`
}

type AppliedFilters struct {
	Status    string  `json:"status"`
	Query     string  `json:"query,omitempty"`
	MonitorID *string `json:"monitor_id,omitempty"`
	From      *string `json:"from,omitempty"`
	To        *string `json:"to,omitempty"`
}
