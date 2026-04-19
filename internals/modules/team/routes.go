package team

import (
	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/go-chi/chi/v5"
)

func Routes(h *Handler, authMW *middle.AuthMiddleware) chi.Router {
	r := chi.NewRouter()

	// public — used by the invite accept page
	r.Get("/invitations/{token}", h.GetInvitationByToken)
	r.Post("/invitations/accept", h.AcceptInvitation)

	// authenticated
	r.With(authMW.Handle).Group(func(r chi.Router) {
		r.Get("/", h.GetTeam)
		r.Get("/members", h.ListMembers)
		r.With(middle.RequireRole(RoleOwner, RoleAdmin)).Patch("/members/{memberID}", h.SetMemberActive)

		// owner or admin only
		r.With(middle.RequireRole(RoleOwner, RoleAdmin)).Put("/", h.UpdateTeam)
		r.With(middle.RequireRole(RoleOwner, RoleAdmin)).Post("/invitations", h.CreateInvitation)
		r.With(middle.RequireRole(RoleOwner, RoleAdmin)).Get("/invitations", h.ListInvitations)
		r.With(middle.RequireRole(RoleOwner, RoleAdmin)).Delete("/invitations/{invitationID}", h.RevokeInvitation)
	})

	return r
}
