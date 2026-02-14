package monitor

import "github.com/go-chi/chi/v5"

func Routes(h *Handler) chi.Router {
	r := chi.NewRouter()

	r.Post("/", h.CreateMonitor)
	r.Get("/", h.GetAllMonitors)
	r.Get("/{monitorID}", h.GetMonitor)
	r.Patch("/{monitorID}", h.UpdateMonitorStatus)

	return r
}
