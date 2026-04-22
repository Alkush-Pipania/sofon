package team

import (
	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/go-chi/chi/v5"
)

func Routes(h *Handler, authMW *middle.AuthMiddleware, teamAccessMW *middle.TeamAccessMiddleware) chi.Router {
	r := chi.NewRouter()

	// Public — used by the invite accept page (token is globally unique)
	r.Get("/invitations/{token}", h.GetInvitationByToken)
	r.Post("/invitations/accept", h.AcceptInvitation)

	// Authenticated — list and create teams
	r.With(authMW.Handle).Get("/", h.ListMyTeams)
	r.With(authMW.Handle).Post("/", h.CreateTeam)

	// Team-scoped — requires auth + team membership
	r.With(authMW.Handle).Route("/{teamID}", func(r chi.Router) {
		r.Use(teamAccessMW.Handle)

		r.Get("/", h.GetTeam)
		r.With(middle.RequireTeamRole(RoleOwner, RoleAdmin)).Put("/", h.UpdateTeam)

		r.Get("/members", h.ListMembers)
		r.With(middle.RequireTeamRole(RoleOwner, RoleAdmin)).Patch("/members/{memberID}", h.SetMemberActive)

		r.With(middle.RequireTeamRole(RoleOwner, RoleAdmin)).Post("/invitations", h.CreateInvitation)
		r.With(middle.RequireTeamRole(RoleOwner, RoleAdmin)).Get("/invitations", h.ListInvitations)
		r.With(middle.RequireTeamRole(RoleOwner, RoleAdmin)).Delete("/invitations/{invitationID}", h.RevokeInvitation)
	})

	return r
}
