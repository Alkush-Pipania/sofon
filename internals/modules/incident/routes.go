package incident

import "github.com/go-chi/chi/v5"

func Routes(h *Handler) chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListIncidents)
	r.Get("/{incidentID}", h.GetIncident)

	return r
}
