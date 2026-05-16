package plugin

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

type Handler struct {
	service *Service
	logger  *zerolog.Logger
}

func NewHandler(svc *Service, logger *zerolog.Logger) *Handler {
	return &Handler{service: svc, logger: logger}
}

func (h *Handler) ListPlugins(w http.ResponseWriter, r *http.Request) {
	const op = "handler.plugin.list"
	ctx := r.Context()
	reqID := chimw.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	plugins, err := h.service.ListPlugins(ctx, tm.TeamID)
	if err != nil {
		h.logger.Error().Str("op", op).Err(err).Msg("list plugins")
		utils.FromAppError(w, reqID, err)
		return
	}

	items := make([]PluginResponse, 0, len(plugins))
	for i := range plugins {
		items = append(items, toResponse(&plugins[i], nil))
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "plugins retrieved", ListPluginsResponse{Plugins: items})
}

func (h *Handler) GetPlugin(w http.ResponseWriter, r *http.Request) {
	const op = "handler.plugin.get"
	ctx := r.Context()
	reqID := chimw.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	pluginType := PluginType(chi.URLParam(r, "pluginType"))
	if !isValidType(pluginType) {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "unsupported plugin type")
		return
	}

	p, configMap, err := h.service.GetPlugin(ctx, tm.TeamID, pluginType)
	if err != nil {
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "plugin retrieved", toResponse(&p, maskConfig(configMap)))
}

func (h *Handler) UpsertPlugin(w http.ResponseWriter, r *http.Request) {
	const op = "handler.plugin.upsert"
	ctx := r.Context()
	reqID := chimw.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	pluginType := PluginType(chi.URLParam(r, "pluginType"))
	if !isValidType(pluginType) {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "unsupported plugin type")
		return
	}

	var req UpsertPluginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	if req.Config == nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "config is required")
		return
	}

	p, err := h.service.UpsertPlugin(ctx, tm.TeamID, pluginType, req.Enabled, req.Config)
	if err != nil {
		h.logger.Error().Str("op", op).Err(err).Msg("upsert plugin")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "plugin saved", toResponse(&p, nil))
}

func (h *Handler) DeletePlugin(w http.ResponseWriter, r *http.Request) {
	const op = "handler.plugin.delete"
	ctx := r.Context()
	reqID := chimw.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	pluginType := PluginType(chi.URLParam(r, "pluginType"))
	if !isValidType(pluginType) {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "unsupported plugin type")
		return
	}

	if err := h.service.DeletePlugin(ctx, tm.TeamID, pluginType); err != nil {
		h.logger.Error().Str("op", op).Err(err).Msg("delete plugin")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "plugin deleted", struct{}{})
}

func isValidType(t PluginType) bool {
	return t == PluginTypeResend
}

func toResponse(p *Plugin, config map[string]string) PluginResponse {
	return PluginResponse{
		ID:        p.ID.String(),
		Type:      string(p.Type),
		Enabled:   p.Enabled,
		Config:    config,
		UpdatedAt: p.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

// maskConfig returns the config map with sensitive values partially masked.
func maskConfig(m map[string]string) map[string]string {
	if m == nil {
		return nil
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		if k == "api_key" {
			out[k] = maskKey(v)
		} else {
			out[k] = v
		}
	}
	return out
}

func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + strings.Repeat("*", len(key)-8) + key[len(key)-4:]
}
