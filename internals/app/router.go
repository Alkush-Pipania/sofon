package app

import (
	"net/http"

	"github.com/alkush-pipania/sofon/internals/modules/incident"
	"github.com/alkush-pipania/sofon/internals/modules/monitor"
	"github.com/alkush-pipania/sofon/internals/modules/team"
	"github.com/alkush-pipania/sofon/internals/modules/user"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(container *Container) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Turnstile-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	r.Route("/api/v1", func(v1 chi.Router) {
		v1.Mount("/users", user.Routes(container.userHandler, container.authMW))

		v1.With(container.authMW.Handle).Mount("/monitors", monitor.Routes(container.monitorHandler))
		v1.With(container.authMW.Handle).Mount("/incidents", incident.Routes(container.incidentHandler))
		v1.Mount("/team", team.Routes(container.teamHandler, container.authMW))
	})

	return r
}
