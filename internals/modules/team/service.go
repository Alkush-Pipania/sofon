package team

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/alkush-pipania/sofon/internals/security"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/google/uuid"
)

type Service struct {
	repo    *repository
	hashSvc func(string) (string, error)
	appURL  string
}

func NewService(repo *repository, appURL string) *Service {
	return &Service{
		repo:    repo,
		hashSvc: security.HashPassword,
		appURL:  appURL,
	}
}

func (s *Service) CreateTeam(ctx context.Context, cmd CreateTeamCmd) (Team, error) {
	team, err := s.repo.CreateTeam(ctx, cmd.Name)
	if err != nil {
		return Team{}, err
	}
	// Creator becomes the team owner
	if err := s.repo.AddMember(ctx, team.ID, cmd.CreatorUserID, RoleOwner); err != nil {
		return Team{}, err
	}
	return team, nil
}

func (s *Service) ListUserTeams(ctx context.Context, userID uuid.UUID) ([]Team, error) {
	return s.repo.ListTeamsByUserID(ctx, userID)
}

func (s *Service) GetTeam(ctx context.Context, teamID uuid.UUID) (Team, error) {
	return s.repo.GetTeamByID(ctx, teamID)
}

func (s *Service) UpdateTeamName(ctx context.Context, teamID uuid.UUID, name string) error {
	return s.repo.UpdateTeamName(ctx, teamID, name)
}

func (s *Service) GetMembership(ctx context.Context, userID, teamID uuid.UUID) (middle.TeamMemberCtx, error) {
	return s.repo.GetMembership(ctx, userID, teamID)
}

func (s *Service) ListMembers(ctx context.Context, teamID uuid.UUID) ([]Member, error) {
	return s.repo.ListMembers(ctx, teamID)
}

func (s *Service) SetMemberActive(ctx context.Context, teamID, targetID, callerID uuid.UUID, active bool) error {
	const op = "service.team.set_member_active"

	if targetID == callerID {
		return &apperror.Error{
			Kind:    apperror.Forbidden,
			Op:      op,
			Message: "you cannot change your own status",
		}
	}
	return s.repo.SetMemberActive(ctx, teamID, targetID, active)
}

func (s *Service) CreateInvitation(ctx context.Context, cmd CreateInvitationCmd) (Invitation, error) {
	const op = "service.team.create_invitation"

	token, err := generateToken()
	if err != nil {
		return Invitation{}, &apperror.Error{
			Kind:    apperror.Internal,
			Op:      op,
			Message: "failed to generate invitation token",
			Err:     err,
		}
	}

	expiresAt := time.Now().Add(48 * time.Hour)
	return s.repo.CreateInvitation(ctx, cmd, token, expiresAt)
}

func (s *Service) ListInvitations(ctx context.Context, teamID uuid.UUID) ([]Invitation, error) {
	return s.repo.ListInvitations(ctx, teamID)
}

func (s *Service) RevokeInvitation(ctx context.Context, teamID, invID uuid.UUID) error {
	return s.repo.DeleteInvitation(ctx, teamID, invID)
}

func (s *Service) GetInvitationByToken(ctx context.Context, token string) (Invitation, error) {
	const op = "service.team.get_invitation_by_token"

	inv, err := s.repo.GetInvitationByToken(ctx, token)
	if err != nil {
		return Invitation{}, err
	}

	if inv.AcceptedAt != nil {
		return Invitation{}, &apperror.Error{
			Kind:    apperror.Conflict,
			Op:      op,
			Message: "invitation has already been accepted",
		}
	}

	if time.Now().After(inv.ExpiresAt) {
		return Invitation{}, &apperror.Error{
			Kind:    apperror.Forbidden,
			Op:      op,
			Message: "invitation has expired",
		}
	}

	return inv, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, cmd AcceptInvitationCmd) error {
	const op = "service.team.accept_invitation"

	inv, err := s.GetInvitationByToken(ctx, cmd.Token)
	if err != nil {
		return err
	}

	// Check if user already exists
	existingUserID, exists, err := s.repo.GetUserByEmail(ctx, inv.Email)
	if err != nil {
		return err
	}

	var userID uuid.UUID
	if exists {
		userID = existingUserID
	} else {
		hashedPw, err := s.hashSvc(cmd.Password)
		if err != nil {
			return &apperror.Error{Kind: apperror.Internal, Op: op, Message: "internal error", Err: err}
		}
		userID, err = s.repo.CreateUser(ctx, inv.Email, cmd.Name, hashedPw, inv.Role)
		if err != nil {
			return err
		}
	}

	if err := s.repo.AddMember(ctx, inv.TeamID, userID, inv.Role); err != nil {
		return err
	}

	return s.repo.AcceptInvitation(ctx, cmd.Token)
}

func (s *Service) InviteLink(token string) string {
	return s.appURL + "/invite/" + token
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
