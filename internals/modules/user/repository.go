package user

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

type repository struct {
	querier *db.Queries
	logger  *zerolog.Logger
}

func NewRepository(dbExecutor db.DBTX, logger *zerolog.Logger) *repository {
	return &repository{
		querier: db.New(dbExecutor),
		logger:  logger,
	}
}

func (r *repository) CreateUser(ctx context.Context, user CreateUserCmd) (uuid.UUID, error) {
	const op string = "repo.user.create_user"

	id, err := r.querier.CreateUser(ctx, db.CreateUserParams{
		Name:         user.Name,
		Email:        user.Email,
		PasswordHash: user.PasswordHash,
		Role:         user.Role,
	})
	if err == nil {
		return utils.FromPgUUID(id), nil
	}

	// from here we handle errors

	// Context errors
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return uuid.UUID{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	// PostgreSQL errors
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// Unique constraint → conflict
		if pgErr.Code == "23505" {
			return uuid.UUID{}, &apperror.Error{
				Kind:    apperror.AlreadyExists,
				Op:      op,
				Message: "user already exists",
			}
		}

		r.logger.Error().
			Str("code", pgErr.Code).
			Str("constraint", pgErr.ConstraintName).
			Str("table", pgErr.TableName).
			Err(err).
			Msg("database error")

		// Any other constraint / data issue
		return uuid.UUID{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	// Everything else
	return uuid.UUID{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *repository) GetUserByID(ctx context.Context, userID uuid.UUID) (User, error) {
	const op string = "repo.user.get_user_by_id"

	user, err := r.querier.GetUserByID(ctx, utils.ToPgUUID(userID))
	if err == nil {
		return User{
			ID:            utils.FromPgUUID(user.ID),
			Name:          user.Name,
			Email:         user.Email,
			PasswordHash:  user.PasswordHash,
			MonitorsCount: utils.FromPgInt32(user.MonitorsCount),
		}, nil
	}

	// Context errors
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return User{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	// if no row present
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, &apperror.Error{
			Kind:    apperror.NotFound,
			Op:      op,
			Message: "Monitor not found",
		}
	}

	// postgres errors
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// log it
		r.logger.Error().
			Str("code", pgErr.Code).
			Str("constraint", pgErr.ConstraintName).
			Str("table", pgErr.TableName).
			Err(err).
			Msg("database error")

		return User{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	// other errors
	return User{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *repository) GetUserByEmail(ctx context.Context, email string) (User, error) {
	const op string = "repo.user.get_user_by_email"

	user, err := r.querier.GetUserByEmail(ctx, email)
	if err == nil {
		return User{
			ID:           utils.FromPgUUID(user.ID),
			Name:         user.Name,
			Email:        user.Email,
			PasswordHash: user.PasswordHash,
			Role:         user.Role,
			IsActive:     user.IsActive,
		}, nil
	}

	// Context errors
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return User{}, &apperror.Error{
			Kind:    apperror.RequestTimeout,
			Op:      op,
			Message: "request cancelled or timed out",
		}
	}

	// if no row present
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, &apperror.Error{
			Kind:    apperror.NotFound,
			Op:      op,
			Message: "User not found",
		}
	}

	// postgres errors
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// log it
		r.logger.Error().
			Str("code", pgErr.Code).
			Str("constraint", pgErr.ConstraintName).
			Str("table", pgErr.TableName).
			Err(err).
			Msg("database error")

		return User{}, &apperror.Error{
			Kind:    apperror.DatabaseErr,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	// other errors
	return User{}, &apperror.Error{
		Kind:    apperror.Internal,
		Op:      op,
		Message: "internal server error",
		Err:     err,
	}
}

func (r *repository) IncrementMonitorCount(ctx context.Context, userID uuid.UUID) error {
	const op string = "repo.user.increment_monitor_count"

	rows, err := r.querier.IncrementMonitorCount(ctx, utils.ToPgUUID(userID))
	if err == nil {
		if rows == 0 {
			return &apperror.Error{
				Kind:    apperror.Forbidden,
				Op:      op,
				Message: "monitor quota exceed",
			}
		}
		return nil
	}

	return utils.WrapRepoError(op, err, r.logger)
}

func (r *repository) DecrementMonitorCount(ctx context.Context, userID uuid.UUID) error {
	const op string = "repo.user.decrement_monitor_count"

	err := r.querier.DecrementMonitorCount(ctx, utils.ToPgUUID(userID))
	if err == nil {
		return nil
	}

	return utils.WrapRepoError(op, err, r.logger)
}

func (r *repository) IsUserActive(ctx context.Context, userID uuid.UUID) (bool, error) {
	const op = "repo.user.is_user_active"

	active, err := r.querier.GetUserActiveStatus(ctx, utils.ToPgUUID(userID))
	if err != nil {
		return false, utils.WrapRepoError(op, err, r.logger)
	}
	return active, nil
}

func (r *repository) SetUserActive(ctx context.Context, userID uuid.UUID, active bool) error {
	const op = "repo.user.set_user_active"

	err := r.querier.SetUserActive(ctx, db.SetUserActiveParams{
		IsActive: active,
		ID:       utils.ToPgUUID(userID),
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) HasUsers(ctx context.Context) (bool, error) {
	const op string = "repo.user.has_users"

	has, err := r.querier.HasUsers(ctx)
	if err != nil {
		return false, utils.WrapRepoError(op, err, r.logger)
	}
	return has, nil
}

func (r *repository) GetRegistrationsEnabled(ctx context.Context) (bool, error) {
	const op string = "repo.instance_settings.get_registrations_enabled"

	enabled, err := r.querier.GetRegistrationsEnabled(ctx)
	if err != nil {
		return false, utils.WrapRepoError(op, err, r.logger)
	}
	return enabled, nil
}

func (r *repository) UpdateUserName(ctx context.Context, userID uuid.UUID, name string) error {
	const op = "repo.user.update_user_name"
	err := r.querier.UpdateUserName(ctx, db.UpdateUserNameParams{
		Name: name,
		ID:   utils.ToPgUUID(userID),
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) GetUserPasswordHash(ctx context.Context, userID uuid.UUID) (string, error) {
	const op = "repo.user.get_user_password_hash"
	hash, err := r.querier.GetUserPasswordHash(ctx, utils.ToPgUUID(userID))
	if err != nil {
		return "", utils.WrapRepoError(op, err, r.logger)
	}
	return hash, nil
}

func (r *repository) UpdateUserPassword(ctx context.Context, userID uuid.UUID, hash string) error {
	const op = "repo.user.update_user_password"
	err := r.querier.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		PasswordHash: hash,
		ID:           utils.ToPgUUID(userID),
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) SetRegistrationsEnabled(ctx context.Context, enabled bool) error {
	const op string = "repo.instance_settings.set_registrations_enabled"

	err := r.querier.SetRegistrationsEnabled(ctx, enabled)
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}
