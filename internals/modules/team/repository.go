package team

import (
	"context"
	"errors"
	"time"

	"github.com/alkush-pipania/sofon/pkg/db"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

func (r *repository) GetTeam(ctx context.Context) (Team, error) {
	const op = "repo.team.get_team"

	row, err := r.querier.GetTeam(ctx)
	if err != nil {
		return Team{}, utils.WrapRepoError(op, err, r.logger)
	}
	return Team{ID: int(row.ID), Name: row.Name}, nil
}

func (r *repository) UpdateTeamName(ctx context.Context, name string) error {
	const op = "repo.team.update_team_name"

	err := r.querier.UpdateTeamName(ctx, name)
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) ListMembers(ctx context.Context) ([]Member, error) {
	const op = "repo.team.list_members"

	rows, err := r.querier.ListUsers(ctx)
	if err != nil {
		return nil, utils.WrapRepoError(op, err, r.logger)
	}

	members := make([]Member, len(rows))
	for i, u := range rows {
		members[i] = Member{
			ID:        utils.FromPgUUID(u.ID),
			Name:      u.Name,
			Email:     u.Email,
			Role:      u.Role,
			IsActive:  u.IsActive,
			CreatedAt: u.CreatedAt.Time,
		}
	}
	return members, nil
}

func (r *repository) CreateInvitation(ctx context.Context, cmd CreateInvitationCmd, token string, expiresAt time.Time) (Invitation, error) {
	const op = "repo.team.create_invitation"

	row, err := r.querier.CreateInvitation(ctx, db.CreateInvitationParams{
		Email:     cmd.Email,
		Role:      cmd.Role,
		Token:     token,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
		InvitedBy: utils.ToPgUUID(cmd.InvitedBy),
	})
	if err != nil {
		return Invitation{}, utils.WrapRepoError(op, err, r.logger)
	}

	inv := Invitation{
		ID:        utils.FromPgUUID(row.ID),
		Email:     row.Email,
		Role:      row.Role,
		Token:     row.Token,
		ExpiresAt: row.ExpiresAt.Time,
		InvitedBy: utils.FromPgUUID(row.InvitedBy),
		CreatedAt: row.CreatedAt.Time,
	}
	if row.AcceptedAt.Valid {
		t := row.AcceptedAt.Time
		inv.AcceptedAt = &t
	}
	return inv, nil
}

func (r *repository) GetInvitationByToken(ctx context.Context, token string) (Invitation, error) {
	const op = "repo.team.get_invitation_by_token"

	row, err := r.querier.GetInvitationByToken(ctx, token)
	if err != nil {
		return Invitation{}, utils.WrapRepoError(op, err, r.logger)
	}

	inv := Invitation{
		ID:        utils.FromPgUUID(row.ID),
		Email:     row.Email,
		Role:      row.Role,
		Token:     row.Token,
		ExpiresAt: row.ExpiresAt.Time,
		InvitedBy: utils.FromPgUUID(row.InvitedBy),
		CreatedAt: row.CreatedAt.Time,
	}
	if row.AcceptedAt.Valid {
		t := row.AcceptedAt.Time
		inv.AcceptedAt = &t
	}
	return inv, nil
}

func (r *repository) ListInvitations(ctx context.Context) ([]Invitation, error) {
	const op = "repo.team.list_invitations"

	rows, err := r.querier.ListInvitations(ctx)
	if err != nil {
		return nil, utils.WrapRepoError(op, err, r.logger)
	}

	invs := make([]Invitation, len(rows))
	for i, row := range rows {
		inv := Invitation{
			ID:        utils.FromPgUUID(row.ID),
			Email:     row.Email,
			Role:      row.Role,
			Token:     row.Token,
			ExpiresAt: row.ExpiresAt.Time,
			InvitedBy: utils.FromPgUUID(row.InvitedBy),
			CreatedAt: row.CreatedAt.Time,
		}
		if row.AcceptedAt.Valid {
			t := row.AcceptedAt.Time
			inv.AcceptedAt = &t
		}
		invs[i] = inv
	}
	return invs, nil
}

func (r *repository) AcceptInvitation(ctx context.Context, token string) error {
	const op = "repo.team.accept_invitation"

	err := r.querier.AcceptInvitation(ctx, token)
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) DeleteInvitation(ctx context.Context, id uuid.UUID) error {
	const op = "repo.team.delete_invitation"

	err := r.querier.DeleteInvitation(ctx, utils.ToPgUUID(id))
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) CreateUser(ctx context.Context, email, name, passwordHash, role string) (uuid.UUID, error) {
	const op = "repo.team.create_user_from_invite"

	id, err := r.querier.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
		Role:         role,
	})
	if err != nil {
		return uuid.UUID{}, utils.WrapRepoError(op, err, r.logger)
	}
	return utils.FromPgUUID(id), nil
}

func (r *repository) SetMemberActive(ctx context.Context, userID uuid.UUID, active bool) error {
	const op = "repo.team.set_member_active"

	err := r.querier.SetUserActive(ctx, db.SetUserActiveParams{
		IsActive: active,
		ID:       utils.ToPgUUID(userID),
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) UserExistsByEmail(ctx context.Context, email string) (bool, error) {
	const op = "repo.team.user_exists_by_email"

	_, err := r.querier.GetUserByEmail(ctx, email)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return false, utils.WrapRepoError(op, err, r.logger)
}
