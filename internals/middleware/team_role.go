package middleware

import (
	"net/http"

	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/go-chi/chi/v5/middleware"
)

// RequireTeamRole checks the caller's role within the team (from TeamMemberCtx)
// against the allowed roles. Must run after TeamAccessMiddleware.
func RequireTeamRole(allowed ...string) func(http.Handler) http.Handler {
	set := make(map[string]struct{}, len(allowed))
	for _, r := range allowed {
		set[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := middleware.GetReqID(r.Context())

			member, ok := TeamMemberFromContext(r.Context())
			if !ok || member == nil {
				utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
				return
			}

			if _, allowed := set[member.Role]; !allowed {
				utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
