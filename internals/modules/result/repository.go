package result

import (
	"context"
	"errors"
	"time"

	"github.com/alkush-pipania/sofon/internals/modules/executor"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/db"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"
)

type MonitorIncidentRepository struct {
	querier *db.Queries
	logger  *zerolog.Logger
}

func NewMonitorIncidentRepo(dbExecutor db.DBTX, logger *zerolog.Logger) *MonitorIncidentRepository {
	return &MonitorIncidentRepository{
		querier: db.New(dbExecutor),
		logger:  logger,
	}
}

func (r *MonitorIncidentRepository) Create(ctx context.Context, startTime time.Time, e executor.HTTPResult) (uuid.UUID, error) {
	const op string = "repo.monitor_incident.create"

	incidentID, err := r.querier.CreateMonitorIncident(ctx, db.CreateMonitorIncidentParams{
		MonitorID:  utils.ToPgUUID(e.MonitorID),
		Alerted:    true,
		HttpStatus: int32(e.Status),
		LatencyMs:  int32(e.LatencyMs),
		StartTime: pgtype.Timestamptz{
			Time:  startTime,
			Valid: true,
		},
	})
	if err == nil {
		return utils.FromPgUUID(incidentID), nil
	}

	return uuid.UUID{}, utils.WrapRepoError(op, err, r.logger)
}

func (r *MonitorIncidentRepository) GetByID(ctx context.Context, incidentID uuid.UUID) (MonitorIncident, error) {
	const op string = "repo.monitor_incident.get"

	mI, err := r.querier.GetMonitorIncidentByID(ctx, utils.ToPgUUID(incidentID))
	if err == nil {
		return MonitorIncident{
			ID:         utils.FromPgUUID(mI.ID),
			MonitorID:  utils.FromPgUUID(mI.MonitorID),
			Alerted:    mI.Alerted,
			HttpStatus: mI.HttpStatus,
			LatencyMs:  mI.LatencyMs,
			StartTime:  utils.FromPgTimestamptz(mI.StartTime),
			CreatedAt:  utils.FromPgTimestamptz(mI.CreatedAt),
			EndTime:    utils.FromPgTimestamptz(mI.EndTime),
		}, nil
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return MonitorIncident{}, &apperror.Error{
			Kind:    apperror.NotFound,
			Op:      op,
			Message: "monitor incident not found",
		}
	}

	return MonitorIncident{}, utils.WrapRepoError(op, err, r.logger)
}

func (r *MonitorIncidentRepository) CloseIncident(ctx context.Context, monitorID uuid.UUID, endTime time.Time) (uuid.UUID, bool, error) {
	const op string = "repo.monitor_incident.close_incident"

	closedIncidentID, err := r.querier.CloseMonitorIncident(ctx, db.CloseMonitorIncidentParams{
		MonitorID: utils.ToPgUUID(monitorID),
		EndTime:   utils.ToPgTimestamptz(endTime),
	})
	if err == nil {
		return utils.FromPgUUID(closedIncidentID), true, nil
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}

	return uuid.Nil, false, utils.WrapRepoError(op, err, r.logger)
}
