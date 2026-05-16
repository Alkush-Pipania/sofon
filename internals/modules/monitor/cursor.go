package monitor

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

type cursorPayload struct {
	CreatedAt string `json:"c"`
	MonitorID string `json:"m"`
}

func EncodeCursor(c Cursor) (string, error) {
	p := cursorPayload{
		CreatedAt: c.CreatedAt.UTC().Format(time.RFC3339Nano),
		MonitorID: c.MonitorID,
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func DecodeCursor(v string) (*Cursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(v)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor")
	}

	var p cursorPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("invalid cursor")
	}
	if p.CreatedAt == "" || p.MonitorID == "" {
		return nil, fmt.Errorf("invalid cursor")
	}

	createdAt, err := time.Parse(time.RFC3339Nano, p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor")
	}

	return &Cursor{
		CreatedAt: createdAt,
		MonitorID: p.MonitorID,
	}, nil
}
