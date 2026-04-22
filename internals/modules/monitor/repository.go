package monitor

import (
	"context"
	"errors"

	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/db"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

type Repository struct {
	querier *db.Queries
	log     *zerolog.Logger
}

func NewRepository(dbExecutor db.DBTX, logger *zerolog.Logger) *Repository {
	return &Repository{
		querier: db.New(dbExecutor),
		log:     logger,
	}
}

func (r *Repository) Create(ctx context.Context, monitor CreateMonitor) (uuid.UUID, error) {
	const op string = "repo.monitor.create"

	monitorID, err := r.querier.CreateMonitor(ctx, db.CreateMonitorParams{
		UserID:             utils.ToPgUUID(monitor.UserID),
		TeamID:             utils.ToPgUUID(monitor.TeamID),
		Url:                monitor.Url,
		IntervalSec:        monitor.IntervalSec,
		TimeoutSec:         monitor.TimeoutSec,
		LatencyThresholdMs: utils.ToPgInt4(monitor.LatencyThresholdMs),
		ExpectedStatus:     utils.ToPgInt4(monitor.ExpectedStatus),
		AlertEmail:         utils.ToPgText(monitor.AlertEmail),
	})
	if err == nil {
		return utils.FromPgUUID(monitorID), nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return uuid.UUID{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		r.log.Error().
			Str("code", pgErr.Code).
			Str("constraint", pgErr.ConstraintName).
			Str("table", pgErr.TableName).
			Err(err).
			Msg("database error")

		return uuid.UUID{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	return uuid.UUID{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *Repository) GetByID(ctx context.Context, monitorID uuid.UUID) (Monitor, error) {
	const op string = "repo.monitor.get_by_id"

	monitor, err := r.querier.GetMonitorByID(ctx, utils.ToPgUUID(monitorID))
	if err == nil {
		return Monitor{
			ID:                 utils.FromPgUUID(monitor.ID),
			TeamID:             utils.FromPgUUID(monitor.TeamID),
			UserID:             utils.FromPgUUID(monitor.UserID),
			Url:                monitor.Url,
			IntervalSec:        monitor.IntervalSec,
			TimeoutSec:         monitor.TimeoutSec,
			LatencyThresholdMs: utils.FromPgInt4(monitor.LatencyThresholdMs),
			ExpectedStatus:     utils.FromPgInt4(monitor.ExpectedStatus),
			Enabled:            monitor.Enabled,
			AlertEmail:         utils.FromPgText(monitor.AlertEmail),
		}, nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return Monitor{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return Monitor{}, &apperror.Error{
			Kind:    apperror.NotFound,
			Op:      op,
			Message: "Monitor not found",
		}
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return Monitor{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	return Monitor{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *Repository) Get(ctx context.Context, teamID, monitorID uuid.UUID) (Monitor, error) {
	const op string = "repo.monitor.get"

	monitor, err := r.querier.GetMonitorByTeamID(ctx, db.GetMonitorByTeamIDParams{
		ID:     utils.ToPgUUID(monitorID),
		TeamID: utils.ToPgUUID(teamID),
	})
	if err == nil {
		return Monitor{
			ID:                 utils.FromPgUUID(monitor.ID),
			TeamID:             utils.FromPgUUID(monitor.TeamID),
			UserID:             utils.FromPgUUID(monitor.UserID),
			Url:                monitor.Url,
			IntervalSec:        monitor.IntervalSec,
			TimeoutSec:         monitor.TimeoutSec,
			LatencyThresholdMs: utils.FromPgInt4(monitor.LatencyThresholdMs),
			ExpectedStatus:     utils.FromPgInt4(monitor.ExpectedStatus),
			Enabled:            monitor.Enabled,
			AlertEmail:         utils.FromPgText(monitor.AlertEmail),
		}, nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return Monitor{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return Monitor{}, &apperror.Error{
			Kind:    apperror.NotFound,
			Op:      op,
			Message: "Monitor not found",
		}
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return Monitor{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	return Monitor{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *Repository) GetAll(ctx context.Context, teamID uuid.UUID, limit int32, offset int32) ([]Monitor, error) {
	const op string = "repo.monitor.get_all"

	monitors, err := r.querier.GetAllMonitorsByTeamID(ctx, db.GetAllMonitorsByTeamIDParams{
		TeamID: utils.ToPgUUID(teamID),
		Limit:  limit,
		Offset: offset,
	})
	if err == nil {
		if len(monitors) == 0 {
			return []Monitor{}, nil
		}
		m := make([]Monitor, 0, len(monitors))
		for i := range monitors {
			mon := &monitors[i]
			m = append(m, Monitor{
				ID:                 utils.FromPgUUID(mon.ID),
				TeamID:             utils.FromPgUUID(mon.TeamID),
				UserID:             utils.FromPgUUID(mon.UserID),
				Url:                mon.Url,
				IntervalSec:        mon.IntervalSec,
				TimeoutSec:         mon.TimeoutSec,
				LatencyThresholdMs: utils.FromPgInt4(mon.LatencyThresholdMs),
				ExpectedStatus:     utils.FromPgInt4(mon.ExpectedStatus),
				Enabled:            mon.Enabled,
				AlertEmail:         utils.FromPgText(mon.AlertEmail),
			})
		}
		return m, nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return []Monitor{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return []Monitor{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	return []Monitor{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *Repository) Delete(ctx context.Context, teamID, monitorID uuid.UUID) error {
	const op string = "repo.monitor.delete"

	rows, err := r.querier.DeleteMonitor(ctx, db.DeleteMonitorParams{
		ID:     utils.ToPgUUID(monitorID),
		TeamID: utils.ToPgUUID(teamID),
	})
	if err == nil {
		if rows == 0 {
			return &apperror.Error{
				Kind:    apperror.NotFound,
				Op:      op,
				Message: "monitor not found",
			}
		}
		return nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	return &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *Repository) SetEnabled(ctx context.Context, teamID, monitorID uuid.UUID, enabled bool) error {
	const op string = "repo.monitor.enable_disable_monitor"

	rows, err := r.querier.UpdateMonitorStatus(ctx, db.UpdateMonitorStatusParams{
		ID:      utils.ToPgUUID(monitorID),
		TeamID:  utils.ToPgUUID(teamID),
		Enabled: enabled,
	})
	if err == nil {
		if rows == 0 {
			return &apperror.Error{
				Kind:    apperror.NotFound,
				Op:      op,
				Message: "monitor not found",
			}
		}
		return nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	return &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}
