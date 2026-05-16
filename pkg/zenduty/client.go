package zenduty

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client sends events to the Zenduty Events API.
type Client interface {
	SendEvent(ctx context.Context, req *EventRequest) (*EventResponse, error)
}

type clientImpl struct {
	integrationURL string
	httpClient     *http.Client
}

func NewClient(integrationURL string) Client {
	return &clientImpl{
		integrationURL: integrationURL,
		httpClient:     &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *clientImpl) SendEvent(ctx context.Context, req *EventRequest) (*EventResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("zenduty: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.integrationURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("zenduty: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("zenduty: send request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("zenduty: unexpected status %d: %s", resp.StatusCode, string(raw))
	}

	var result EventResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("zenduty: decode response: %w", err)
	}
	return &result, nil
}
