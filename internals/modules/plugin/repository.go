package plugin

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/alkush-pipania/sofon/internals/modules/alert"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/crypto"
	"github.com/alkush-pipania/sofon/pkg/db"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"
)

type Repository struct {
	querier   *db.Queries
	encryptor *crypto.Encryptor
	log       *zerolog.Logger
}

func NewRepository(dbExecutor db.DBTX, enc *crypto.Encryptor, logger *zerolog.Logger) *Repository {
	return &Repository{
		querier:   db.New(dbExecutor),
		encryptor: enc,
		log:       logger,
	}
}

func (r *Repository) Upsert(ctx context.Context, teamID uuid.UUID, pluginType PluginType, enabled bool, configMap map[string]string) (Plugin, error) {
	const op = "repo.plugin.upsert"

	raw, err := json.Marshal(configMap)
	if err != nil {
		return Plugin{}, &apperror.Error{Kind: apperror.Internal, Op: op, Message: "failed to encode config", Err: err}
	}

	enc, err := r.encryptor.Encrypt(string(raw))
	if err != nil {
		return Plugin{}, &apperror.Error{Kind: apperror.Internal, Op: op, Message: "failed to encrypt config", Err: err}
	}

	row, err := r.querier.UpsertPlugin(ctx, db.UpsertPluginParams{
		TeamID:     utils.ToPgUUID(teamID),
		PluginType: string(pluginType),
		Enabled:    enabled,
		ConfigEnc:  enc,
	})
	if err != nil {
		return Plugin{}, utils.WrapRepoError(op, err, r.log)
	}

	return rowToPlugin(row), nil
}

func (r *Repository) Get(ctx context.Context, teamID uuid.UUID, pluginType PluginType) (Plugin, map[string]string, error) {
	const op = "repo.plugin.get"

	row, err := r.querier.GetPlugin(ctx, db.GetPluginParams{
		TeamID:     utils.ToPgUUID(teamID),
		PluginType: string(pluginType),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Plugin{}, nil, &apperror.Error{Kind: apperror.NotFound, Op: op, Message: "plugin not configured"}
		}
		return Plugin{}, nil, utils.WrapRepoError(op, err, r.log)
	}

	configMap, err := r.decrypt(row.ConfigEnc, op)
	if err != nil {
		return Plugin{}, nil, err
	}

	return rowToPlugin(row), configMap, nil
}

// GetResendConfig is called by the alert service at send-time.
// It satisfies the alert.PluginConfigGetter interface.
func (r *Repository) GetResendConfig(ctx context.Context, teamID uuid.UUID) (alert.ResendEmailConfig, bool, error) {
	const op = "repo.plugin.get_resend_config"

	row, err := r.querier.GetPlugin(ctx, db.GetPluginParams{
		TeamID:     utils.ToPgUUID(teamID),
		PluginType: string(PluginTypeResend),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return alert.ResendEmailConfig{}, false, nil
		}
		return alert.ResendEmailConfig{}, false, utils.WrapRepoError(op, err, r.log)
	}

	if !row.Enabled {
		return alert.ResendEmailConfig{}, false, nil
	}

	configMap, err := r.decrypt(row.ConfigEnc, op)
	if err != nil {
		return alert.ResendEmailConfig{}, false, err
	}

	return alert.ResendEmailConfig{
		APIKey:      configMap["api_key"],
		SenderEmail: configMap["sender_email"],
	}, true, nil
}

func (r *Repository) List(ctx context.Context, teamID uuid.UUID) ([]Plugin, error) {
	const op = "repo.plugin.list"

	rows, err := r.querier.ListPlugins(ctx, utils.ToPgUUID(teamID))
	if err != nil {
		return nil, utils.WrapRepoError(op, err, r.log)
	}

	plugins := make([]Plugin, 0, len(rows))
	for i := range rows {
		plugins = append(plugins, rowToPlugin(rows[i]))
	}
	return plugins, nil
}

func (r *Repository) Delete(ctx context.Context, teamID uuid.UUID, pluginType PluginType) error {
	const op = "repo.plugin.delete"

	err := r.querier.DeletePlugin(ctx, db.DeletePluginParams{
		TeamID:     utils.ToPgUUID(teamID),
		PluginType: string(pluginType),
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.log)
	}
	return nil
}

func (r *Repository) decrypt(enc, op string) (map[string]string, error) {
	plain, err := r.encryptor.Decrypt(enc)
	if err != nil {
		return nil, &apperror.Error{Kind: apperror.Internal, Op: op, Message: "failed to decrypt config", Err: err}
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(plain), &m); err != nil {
		return nil, &apperror.Error{Kind: apperror.Internal, Op: op, Message: "failed to decode config", Err: err}
	}
	return m, nil
}

func rowToPlugin(row db.Plugin) Plugin {
	return Plugin{
		ID:        utils.FromPgUUID(row.ID),
		TeamID:    utils.FromPgUUID(row.TeamID),
		Type:      PluginType(row.PluginType),
		Enabled:   row.Enabled,
		CreatedAt: utils.FromPgTimestamptz(row.CreatedAt),
		UpdatedAt: utils.FromPgTimestamptz(row.UpdatedAt),
	}
}
