package user

import (
	"context"

	"github.com/alkush-pipania/sofon/internals/security"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/google/uuid"
)

type Service struct {
	repo     *repository
	tokenSvc *security.TokenService
}

func NewService(repo *repository, tokenSvc *security.TokenService) *Service {
	return &Service{
		repo:     repo,
		tokenSvc: tokenSvc,
	}
}

func (s *Service) Register(ctx context.Context, data CreateUserCmd) (uuid.UUID, error) {
	const op = "service.user.register"

	enabled, err := s.repo.GetRegistrationsEnabled(ctx)
	if err != nil {
		return uuid.UUID{}, err
	}
	if !enabled {
		return uuid.UUID{}, &apperror.Error{
			Kind:    apperror.Forbidden,
			Op:      op,
			Message: "registration is disabled. Please contact the administrator.",
		}
	}

	hasUsers, err := s.repo.HasUsers(ctx)
	if err != nil {
		return uuid.UUID{}, err
	}

	data.Role = "member"
	if !hasUsers {
		data.Role = "owner"
	}

	hashedPassword, err := security.HashPassword(data.PasswordHash)
	if err != nil {
		return uuid.UUID{}, err
	}
	data.PasswordHash = hashedPassword

	id, err := s.repo.CreateUser(ctx, data)
	if err != nil {
		return uuid.UUID{}, err
	}

	// first user becomes admin — lock registrations from now on
	if !hasUsers {
		_ = s.repo.SetRegistrationsEnabled(ctx, false)
	}

	return id, nil
}

func (s *Service) SetupStatus(ctx context.Context) (bool, error) {
	enabled, err := s.repo.GetRegistrationsEnabled(ctx)
	if err != nil || !enabled {
		return false, err
	}

	// flag says open — but if users already exist, registrations are closed
	hasUsers, err := s.repo.HasUsers(ctx)
	if err != nil {
		return false, err
	}
	if hasUsers {
		_ = s.repo.SetRegistrationsEnabled(ctx, false) // self-heal stale flag
		return false, nil
	}

	return true, nil
}

func (s *Service) LogIn(ctx context.Context, data LogInUserCmd) (LogInUserResult, error) {
	const op string = "service.user.login"

	u, err := s.repo.GetUserByEmail(ctx, data.Email)
	if err != nil {
		if apperror.IsKind(err, apperror.NotFound) {
			return LogInUserResult{}, &apperror.Error{
				Kind:    apperror.Unauthorised,
				Op:      op,
				Message: "incorrect email or password",
			}
		}
		return LogInUserResult{}, err
	}

	if !u.IsActive {
		return LogInUserResult{}, &apperror.Error{
			Kind:    apperror.Unauthorised,
			Op:      op,
			Message: "your account has been deactivated. Please contact the administrator.",
		}
	}

	ok, err := security.ComparePassword(data.Password, u.PasswordHash)
	if err != nil || !ok {
		return LogInUserResult{}, &apperror.Error{
			Kind:    apperror.Unauthorised,
			Op:      op,
			Message: "incorrect email or password",
		}
	}
	payload := security.RequestClaims{
		UserID: u.ID.String(),
		Email:  u.Email,
		Role:   u.Role,
	}

	// generate JWT Token with 30 min expiry (as it is just basics)
	token, err := s.tokenSvc.GenerateAccessToken(payload) // sceret , expiry is there in token service, we just pass payload
	if err != nil {
		return LogInUserResult{}, &apperror.Error{
			Kind:    apperror.Internal,
			Op:      op,
			Message: "internal server error",
			Err:     err,
		}
	}

	res := LogInUserResult{
		UserID:      u.ID,
		AccessToken: token,
	}
	return res, nil
}

func (s *Service) GetProfile(ctx context.Context, userId uuid.UUID) (User, error) {

	u, err := s.repo.GetUserByID(ctx, userId)
	if err != nil {
		return User{}, err
	}
	return u, nil
}

func (s *Service) GetUserByID(ctx context.Context, userID uuid.UUID) (User, error) {

	// const op string = "service.user.get_user_by_id"

	dbUser, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return User{}, err
	}
	return dbUser, nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, name string) error {
	return s.repo.UpdateUserName(ctx, userID, name)
}

func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPw, newPw string) error {
	const op = "service.user.change_password"

	hash, err := s.repo.GetUserPasswordHash(ctx, userID)
	if err != nil {
		return err
	}

	ok, err := security.ComparePassword(currentPw, hash)
	if err != nil || !ok {
		return &apperror.Error{
			Kind:    apperror.Unauthorised,
			Op:      op,
			Message: "current password is incorrect",
		}
	}

	newHash, err := security.HashPassword(newPw)
	if err != nil {
		return &apperror.Error{Kind: apperror.Internal, Op: op, Message: "internal error", Err: err}
	}

	return s.repo.UpdateUserPassword(ctx, userID, newHash)
}

func (s *Service) IsUserActive(ctx context.Context, userID uuid.UUID) (bool, error) {
	return s.repo.IsUserActive(ctx, userID)
}

func (s *Service) IncrementMonitorCount(ctx context.Context, userID uuid.UUID) error {
	return s.repo.IncrementMonitorCount(ctx, userID)
}

func (s *Service) DecrementMonitorCount(ctx context.Context, userID uuid.UUID) error {
	return s.repo.DecrementMonitorCount(ctx, userID)
}
