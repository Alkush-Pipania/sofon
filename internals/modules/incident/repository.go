package incident

import (
	"context"
	"errors"
	"time"

	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/db"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"
)

type Repository struct {
	querier *db.Queries
	logger  *zerolog.Logger
}

func NewRepository(dbExecutor db.DBTX, logger *zerolog.Logger) *Repository {
	return &Repository{
		querier: db.New(dbExecutor),
		logger:  logger,
	}
}

func (r *Repository) ListByUserID(ctx context.Context, userID uuid.UUID, opts ListIncidentsOptions) ([]Incident, bool, error) {
	const op string = "repo.incident.list_by_user_id"

	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}
	fetchLimit := limit + 1

	var monitorID pgtype.UUID
	if opts.Filters.MonitorID != nil {
		monitorID = utils.ToPgUUID(*opts.Filters.MonitorID)
	}

	var fromTS pgtype.Timestamptz
	if opts.Filters.From != nil {
		fromTS = utils.ToPgTimestamptz(opts.Filters.From.UTC())
	}

	var toTS pgtype.Timestamptz
	if opts.Filters.To != nil {
		toTS = utils.ToPgTimestamptz(opts.Filters.To.UTC())
	}

	var cursorStart pgtype.Timestamptz
	var cursorID pgtype.UUID
	if opts.Cursor != nil {
		parsedCursorID, err := uuid.Parse(opts.Cursor.IncidentID)
		if err != nil {
			return nil, false, &apperror.Error{
				Kind:    apperror.InvalidInput,
				Op:      op,
				Message: "invalid cursor",
			}
		}
		cursorStart = utils.ToPgTimestamptz(opts.Cursor.StartTime.UTC())
		cursorID = utils.ToPgUUID(parsedCursorID)
	}

	rows, err := r.querier.ListIncidentsByUserCursor(ctx, db.ListIncidentsByUserCursorParams{
		UserID:  utils.ToPgUUID(userID),
		Column2: opts.Filters.Status,
		Column3: fromTS,
		Column4: toTS,
		Column5: opts.Filters.Query,
		Column6: monitorID,
		Column7: cursorStart,
		Column8: cursorID,
		Limit:   fetchLimit,
	})
	if err != nil {
		return nil, false, utils.WrapRepoError(op, err, r.logger)
	}

	incidents := make([]Incident, 0, len(rows))
	for i := range rows {
		row := &rows[i]
		incidents = append(incidents, Incident{
			ID:          utils.FromPgUUID(row.ID).String(),
			MonitorID:   utils.FromPgUUID(row.MonitorID).String(),
			MonitorURL:  row.MonitorUrl,
			StartTime:   utils.FromPgTimestamptz(row.StartTime),
			EndTime:     timePtr(row.EndTime),
			Alerted:     row.Alerted,
			HTTPStatus:  row.HttpStatus,
			LatencyMs:   row.LatencyMs,
			CreatedAt:   utils.FromPgTimestamptz(row.CreatedAt),
			IsActive:    row.IsActive,
			DurationSec: row.DurationSec,
			AlertStatus: row.AlertStatus,
			AlertEmail:  row.AlertEmail,
			AlertSentAt: timePtr(row.AlertSentAt),
		})
	}

	hasMore := len(incidents) > int(limit)
	if hasMore {
		incidents = incidents[:limit]
	}

	return incidents, hasMore, nil
}

func (r *Repository) GetByIDAndUserID(ctx context.Context, incidentID uuid.UUID, userID uuid.UUID) (Incident, error) {
	const op string = "repo.incident.get_by_id_and_user_id"

	row, err := r.querier.GetIncidentByIDAndUserID(ctx, db.GetIncidentByIDAndUserIDParams{
		ID:     utils.ToPgUUID(incidentID),
		UserID: utils.ToPgUUID(userID),
	})
	if err == nil {
		return Incident{
			ID:          utils.FromPgUUID(row.ID).String(),
			MonitorID:   utils.FromPgUUID(row.MonitorID).String(),
			MonitorURL:  row.MonitorUrl,
			StartTime:   utils.FromPgTimestamptz(row.StartTime),
			EndTime:     timePtr(row.EndTime),
			Alerted:     row.Alerted,
			HTTPStatus:  row.HttpStatus,
			LatencyMs:   row.LatencyMs,
			CreatedAt:   utils.FromPgTimestamptz(row.CreatedAt),
			IsActive:    row.IsActive,
			DurationSec: row.DurationSec,
			AlertStatus: row.AlertStatus,
			AlertEmail:  row.AlertEmail,
			AlertSentAt: timePtr(row.AlertSentAt),
		}, nil
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return Incident{}, &apperror.Error{
			Kind:    apperror.NotFound,
			Op:      op,
			Message: "incident not found",
		}
	}

	return Incident{}, utils.WrapRepoError(op, err, r.logger)
}

func timePtr(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid || ts.InfinityModifier != pgtype.Finite {
		return nil
	}
	t := ts.Time
	return &t
}
