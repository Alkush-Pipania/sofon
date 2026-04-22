package team

import (
	"context"
	"errors"
	"time"

	middle "github.com/alkush-pipania/sofon/internals/middleware"
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

func (r *repository) CreateTeam(ctx context.Context, name string) (Team, error) {
	const op = "repo.team.create_team"

	row, err := r.querier.CreateTeam(ctx, name)
	if err != nil {
		return Team{}, utils.WrapRepoError(op, err, r.logger)
	}
	return Team{
		ID:        utils.FromPgUUID(row.ID),
		Name:      row.Name,
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}, nil
}

func (r *repository) GetTeamByID(ctx context.Context, teamID uuid.UUID) (Team, error) {
	const op = "repo.team.get_team_by_id"

	row, err := r.querier.GetTeamByID(ctx, utils.ToPgUUID(teamID))
	if err != nil {
		return Team{}, utils.WrapRepoError(op, err, r.logger)
	}
	return Team{
		ID:        utils.FromPgUUID(row.ID),
		Name:      row.Name,
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}, nil
}

func (r *repository) ListTeamsByUserID(ctx context.Context, userID uuid.UUID) ([]Team, error) {
	const op = "repo.team.list_teams_by_user_id"

	rows, err := r.querier.ListTeamsByUserID(ctx, utils.ToPgUUID(userID))
	if err != nil {
		return nil, utils.WrapRepoError(op, err, r.logger)
	}

	teams := make([]Team, len(rows))
	for i, row := range rows {
		teams[i] = Team{
			ID:        utils.FromPgUUID(row.ID),
			Name:      row.Name,
			CreatedAt: row.CreatedAt.Time,
			UpdatedAt: row.UpdatedAt.Time,
		}
	}
	return teams, nil
}

func (r *repository) UpdateTeamName(ctx context.Context, teamID uuid.UUID, name string) error {
	const op = "repo.team.update_team_name"

	err := r.querier.UpdateTeamName(ctx, db.UpdateTeamNameParams{
		ID:   utils.ToPgUUID(teamID),
		Name: name,
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) AddMember(ctx context.Context, teamID, userID uuid.UUID, role string) error {
	const op = "repo.team.add_member"

	_, err := r.querier.AddTeamMember(ctx, db.AddTeamMemberParams{
		TeamID: utils.ToPgUUID(teamID),
		UserID: utils.ToPgUUID(userID),
		Role:   role,
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) GetMembership(ctx context.Context, userID, teamID uuid.UUID) (middle.TeamMemberCtx, error) {
	const op = "repo.team.get_membership"

	row, err := r.querier.GetTeamMembership(ctx, db.GetTeamMembershipParams{
		TeamID: utils.ToPgUUID(teamID),
		UserID: utils.ToPgUUID(userID),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return middle.TeamMemberCtx{}, utils.WrapRepoError(op, pgx.ErrNoRows, r.logger)
		}
		return middle.TeamMemberCtx{}, utils.WrapRepoError(op, err, r.logger)
	}
	return middle.TeamMemberCtx{
		MemberID: utils.FromPgUUID(row.ID),
		TeamID:   utils.FromPgUUID(row.TeamID),
		UserID:   utils.FromPgUUID(row.UserID),
		Role:     row.Role,
		IsActive: row.IsActive,
	}, nil
}

func (r *repository) ListMembers(ctx context.Context, teamID uuid.UUID) ([]Member, error) {
	const op = "repo.team.list_members"

	rows, err := r.querier.ListTeamMembers(ctx, utils.ToPgUUID(teamID))
	if err != nil {
		return nil, utils.WrapRepoError(op, err, r.logger)
	}

	members := make([]Member, len(rows))
	for i, row := range rows {
		members[i] = Member{
			ID:        utils.FromPgUUID(row.ID),
			Name:      row.Name,
			Email:     row.Email,
			Role:      row.Role,
			IsActive:  row.IsActive,
			CreatedAt: row.CreatedAt.Time,
		}
	}
	return members, nil
}

func (r *repository) SetMemberActive(ctx context.Context, teamID, userID uuid.UUID, active bool) error {
	const op = "repo.team.set_member_active"

	err := r.querier.SetTeamMemberActive(ctx, db.SetTeamMemberActiveParams{
		TeamID:   utils.ToPgUUID(teamID),
		UserID:   utils.ToPgUUID(userID),
		IsActive: active,
	})
	if err != nil {
		return utils.WrapRepoError(op, err, r.logger)
	}
	return nil
}

func (r *repository) CreateInvitation(ctx context.Context, cmd CreateInvitationCmd, token string, expiresAt time.Time) (Invitation, error) {
	const op = "repo.team.create_invitation"

	row, err := r.querier.CreateInvitation(ctx, db.CreateInvitationParams{
		TeamID:    utils.ToPgUUID(cmd.TeamID),
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
		TeamID:    utils.FromPgUUID(row.TeamID),
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
		TeamID:    utils.FromPgUUID(row.TeamID),
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

func (r *repository) ListInvitations(ctx context.Context, teamID uuid.UUID) ([]Invitation, error) {
	const op = "repo.team.list_invitations"

	rows, err := r.querier.ListInvitations(ctx, utils.ToPgUUID(teamID))
	if err != nil {
		return nil, utils.WrapRepoError(op, err, r.logger)
	}

	invs := make([]Invitation, len(rows))
	for i, row := range rows {
		inv := Invitation{
			ID:        utils.FromPgUUID(row.ID),
			TeamID:    utils.FromPgUUID(row.TeamID),
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

func (r *repository) DeleteInvitation(ctx context.Context, teamID, invID uuid.UUID) error {
	const op = "repo.team.delete_invitation"

	err := r.querier.DeleteInvitation(ctx, db.DeleteInvitationParams{
		ID:     utils.ToPgUUID(invID),
		TeamID: utils.ToPgUUID(teamID),
	})
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

func (r *repository) GetUserByEmail(ctx context.Context, email string) (uuid.UUID, bool, error) {
	const op = "repo.team.get_user_by_email"

	row, err := r.querier.GetUserByEmail(ctx, email)
	if err == nil {
		return utils.FromPgUUID(row.ID), true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}
	return uuid.Nil, false, utils.WrapRepoError(op, err, r.logger)
}
