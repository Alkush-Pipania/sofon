package incident

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

type cursorPayload struct {
	StartTime  string `json:"s"`
	IncidentID string `json:"i"`
}

func EncodeCursor(c Cursor) (string, error) {
	p := cursorPayload{
		StartTime:  c.StartTime.UTC().Format(time.RFC3339Nano),
		IncidentID: c.IncidentID,
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
	if p.StartTime == "" || p.IncidentID == "" {
		return nil, fmt.Errorf("invalid cursor")
	}

	start, err := time.Parse(time.RFC3339Nano, p.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor")
	}

	return &Cursor{
		StartTime:  start,
		IncidentID: p.IncidentID,
	}, nil
}
