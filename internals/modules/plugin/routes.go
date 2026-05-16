package plugin

import "github.com/go-chi/chi/v5"

func Routes(h *Handler) chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListPlugins)
	r.Get("/{pluginType}", h.GetPlugin)
	r.Put("/{pluginType}", h.UpsertPlugin)
	r.Delete("/{pluginType}", h.DeletePlugin)
	return r
}
