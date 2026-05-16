package middleware

import (
	"context"
	"net/http"

	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

type teamMemberCtxKeyType struct{}

var teamMemberCtxKey = teamMemberCtxKeyType{}

type TeamMemberCtx struct {
	MemberID uuid.UUID
	TeamID   uuid.UUID
	UserID   uuid.UUID
	Role     string
	IsActive bool
}

// TeamMembershipChecker is implemented by the team service.
type TeamMembershipChecker interface {
	GetMembership(ctx context.Context, userID, teamID uuid.UUID) (TeamMemberCtx, error)
}

type TeamAccessMiddleware struct {
	teamSvc TeamMembershipChecker
}

func NewTeamAccess(teamSvc TeamMembershipChecker) *TeamAccessMiddleware {
	return &TeamAccessMiddleware{teamSvc: teamSvc}
}

// Handle validates that the authenticated user is an active member of the team
// identified by the {teamID} URL parameter and injects the membership into context.
func (t *TeamAccessMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		reqID := middleware.GetReqID(ctx)

		claims, ok := UserFromContext(ctx)
		if !ok || claims == nil {
			utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
			return
		}

		teamIDStr := chi.URLParam(r, "teamID")
		teamID, err := uuid.Parse(teamIDStr)
		if err != nil {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid team id")
			return
		}

		member, err := t.teamSvc.GetMembership(ctx, userID, teamID)
		if err != nil {
			utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "you are not a member of this team")
			return
		}

		if !member.IsActive {
			utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "your membership in this team is inactive")
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, teamMemberCtxKey, &member)))
	})
}

func TeamMemberFromContext(ctx context.Context) (*TeamMemberCtx, bool) {
	m, ok := ctx.Value(teamMemberCtxKey).(*TeamMemberCtx)
	return m, ok
}
