package team

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

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

func (s *Service) GetTeam(ctx context.Context) (Team, error) {
	return s.repo.GetTeam(ctx)
}

func (s *Service) UpdateTeamName(ctx context.Context, name string) error {
	return s.repo.UpdateTeamName(ctx, name)
}

func (s *Service) ListMembers(ctx context.Context) ([]Member, error) {
	return s.repo.ListMembers(ctx)
}

func (s *Service) SetMemberActive(ctx context.Context, targetID, callerID uuid.UUID, active bool) error {
	const op = "service.team.set_member_active"

	if targetID == callerID {
		return &apperror.Error{
			Kind:    apperror.Forbidden,
			Op:      op,
			Message: "you cannot change your own status",
		}
	}
	return s.repo.SetMemberActive(ctx, targetID, active)
}

func (s *Service) CreateInvitation(ctx context.Context, cmd CreateInvitationCmd) (Invitation, error) {
	const op = "service.team.create_invitation"

	// block inviting an email that already has an account
	exists, err := s.repo.UserExistsByEmail(ctx, cmd.Email)
	if err != nil {
		return Invitation{}, err
	}
	if exists {
		return Invitation{}, &apperror.Error{
			Kind:    apperror.AlreadyExists,
			Op:      op,
			Message: "a user with this email already exists",
		}
	}

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

func (s *Service) ListInvitations(ctx context.Context) ([]Invitation, error) {
	return s.repo.ListInvitations(ctx)
}

func (s *Service) RevokeInvitation(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteInvitation(ctx, id)
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

	hashedPw, err := s.hashSvc(cmd.Password)
	if err != nil {
		return &apperror.Error{Kind: apperror.Internal, Op: op, Message: "internal error", Err: err}
	}

	_, err = s.repo.CreateUser(ctx, inv.Email, cmd.Name, hashedPw, inv.Role)
	if err != nil {
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
