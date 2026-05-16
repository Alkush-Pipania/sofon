package plugin

import (
	"context"
	"net/mail"
	"strings"

	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) UpsertPlugin(ctx context.Context, teamID uuid.UUID, pluginType PluginType, enabled bool, config map[string]string) (Plugin, error) {
	if err := validateConfig(pluginType, config); err != nil {
		return Plugin{}, err
	}
	return s.repo.Upsert(ctx, teamID, pluginType, enabled, config)
}

func (s *Service) GetPlugin(ctx context.Context, teamID uuid.UUID, pluginType PluginType) (Plugin, map[string]string, error) {
	return s.repo.Get(ctx, teamID, pluginType)
}

func (s *Service) ListPlugins(ctx context.Context, teamID uuid.UUID) ([]Plugin, error) {
	return s.repo.List(ctx, teamID)
}

func (s *Service) DeletePlugin(ctx context.Context, teamID uuid.UUID, pluginType PluginType) error {
	return s.repo.Delete(ctx, teamID, pluginType)
}

func validateConfig(pluginType PluginType, config map[string]string) error {
	const op = "service.plugin.validate"
	switch pluginType {
	case PluginTypeResend:
		if strings.TrimSpace(config["api_key"]) == "" {
			return &apperror.Error{Kind: apperror.InvalidInput, Op: op, Message: "resend api_key is required"}
		}
		if _, err := mail.ParseAddress(config["sender_email"]); err != nil {
			return &apperror.Error{Kind: apperror.InvalidInput, Op: op, Message: "sender_email must be a valid email address"}
		}
	default:
		return &apperror.Error{Kind: apperror.InvalidInput, Op: op, Message: "unsupported plugin type"}
	}
	return nil
}
