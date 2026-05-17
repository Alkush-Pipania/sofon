package plugin

import (
	"time"

	"github.com/google/uuid"
)

type PluginType string

const (
	PluginTypeResend  PluginType = "resend"
	PluginTypeZenduty PluginType = "zenduty"
)

type Plugin struct {
	ID         uuid.UUID
	TeamID     uuid.UUID
	Type       PluginType
	Enabled    bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// ResendConfig holds decrypted Resend credentials.
type ResendConfig struct {
	APIKey         string `json:"api_key"`
	SenderEmail    string `json:"sender_email"`
	RecipientEmail string `json:"recipient_email"`
}
