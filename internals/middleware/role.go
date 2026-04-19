package middleware

import (
	"net/http"

	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/go-chi/chi/v5/middleware"
)

// RequireRole returns a middleware that allows only requests whose JWT role
// is one of the provided allowed roles.
func RequireRole(allowed ...string) func(http.Handler) http.Handler {
	set := make(map[string]struct{}, len(allowed))
	for _, r := range allowed {
		set[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := middleware.GetReqID(r.Context())

			claims, ok := UserFromContext(r.Context())
			if !ok || claims == nil {
				utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
				return
			}

			if _, allowed := set[claims.Role]; !allowed {
				utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
