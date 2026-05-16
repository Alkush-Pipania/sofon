package zenduty

type AlertType string

const (
	AlertTypeCritical AlertType = "critical"
	AlertTypeResolved AlertType = "resolved"
)

type EventRequest struct {
	AlertType AlertType         `json:"alert_type"`
	Message   string            `json:"message"`
	Summary   string            `json:"summary"`
	EntityID  string            `json:"entity_id"`
	Payload   map[string]string `json:"payload,omitempty"`
	URLs      []EventURL        `json:"urls,omitempty"`
}

type EventURL struct {
	LinkURL  string `json:"link_url"`
	LinkText string `json:"link_text"`
}

type EventResponse struct {
	Message string `json:"message"`
	TraceID string `json:"trace_id"`
}
