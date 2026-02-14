package user

import (
	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/go-chi/chi/v5"
)

func Routes(h *Handler, authMW *middle.AuthMiddleware) chi.Router {
	r := chi.NewRouter()

	r.Post("/register", h.Register)
	r.Post("/login", h.LogIn)
	r.With(authMW.Handle).Get("/get-profile", h.GetProfile)

	return r
}
