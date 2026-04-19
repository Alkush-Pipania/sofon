package middleware

/**
- Work of this file -> Auth package:
	- Validates token
	- Creates claims
	- Stores claims in context
	- Exposes a helper to retrieve claims
**/

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/alkush-pipania/sofon/internals/security"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/google/uuid"
)

type userCtxKeyType struct{}

var userCtxKey = userCtxKeyType{}

// ActiveChecker is implemented by the user service to verify a user is still active.
type ActiveChecker interface {
	IsUserActive(ctx context.Context, userID uuid.UUID) (bool, error)
}

type AuthMiddleware struct {
	tokenSvc     *security.TokenService
	activeChecker ActiveChecker
}

func NewAuthMiddleware(tokenSvc *security.TokenService, activeChecker ActiveChecker) *AuthMiddleware {
	return &AuthMiddleware{
		tokenSvc:     tokenSvc,
		activeChecker: activeChecker,
	}
}

func (a *AuthMiddleware) Handle(next http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {

		token, err := a.extractBearerToken(r)
		if err != nil {
			utils.WriteError(w, http.StatusUnauthorized, "", apperror.Unauthorised, err.Error())
			return
		}

		claims, err := a.tokenSvc.ValidateAccessToken(token)
		if err != nil {
			utils.WriteError(w, http.StatusUnauthorized, "", apperror.Unauthorised, "invalid or expired token")
			return
		}

		if claims.UserID == "" || claims.Email == "" {
			utils.WriteError(w, http.StatusUnauthorized, "", apperror.Unauthorised, "user is unauthorised")
			return
		}

		// Check the user is still active (catches mid-session deactivations)
		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			utils.WriteError(w, http.StatusUnauthorized, "", apperror.Unauthorised, "user is unauthorised")
			return
		}
		active, err := a.activeChecker.IsUserActive(r.Context(), userID)
		if err != nil || !active {
			utils.WriteError(w, http.StatusUnauthorized, "", apperror.Unauthorised, "your account has been deactivated")
			return
		}

		ctx := context.WithValue(r.Context(), userCtxKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	}

	return http.HandlerFunc(fn)
}

func (_ *AuthMiddleware) extractBearerToken(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")

	if authHeader == "" {
		return "", errors.New("missing Authorization header")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", errors.New("invalid Authorization header")
	}

	return parts[1], nil
}

func UserFromContext(ctx context.Context) (*security.RequestClaims, bool) {
	claims, ok := ctx.Value(userCtxKey).(*security.RequestClaims)
	return claims, ok
}
