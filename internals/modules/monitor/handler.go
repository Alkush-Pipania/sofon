package monitor

import (
	"encoding/json"
	"net/http"
	"strconv"

	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type Handler struct {
	service   *Service
	validator *validator.Validate
	logger    *zerolog.Logger
}

func NewHandler(service *Service, validator *validator.Validate, logger *zerolog.Logger) *Handler {
	return &Handler{
		service:   service,
		validator: validator,
		logger:    logger,
	}
}

func (h *Handler) CreateMonitor(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.monitor.create_monitor"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	claims, ok := middle.UserFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "user unauthorised")
		return
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "user unauthorised")
		return
	}

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	var req CreateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request")
		return
	}

	mID, err := h.service.CreateMonitor(ctx, CreateMonitor{
		TeamID:             tm.TeamID,
		UserID:             userID,
		Url:                req.Url,
		IntervalSec:        req.IntervalSec,
		TimeoutSec:         req.TimeoutSec,
		LatencyThresholdMs: req.LatencyThresholdMs,
		ExpectedStatus:     req.ExpectedStatus,
		AlertEmail:         req.AlertEmail,
	})
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("create monitor error")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, reqID, "monitor created successfully", CreateMonitorResponse{MonitorID: mID.String()})
}

func (h *Handler) GetMonitor(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.monitor.get_monitor"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	monitorID, err := uuid.Parse(chi.URLParam(r, "monitorID"))
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid input")
		return
	}

	mon, err := h.service.GetMonitor(ctx, tm.TeamID, monitorID)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("retrieving monitor error")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "monitor retrieved", GetMonitorResponse{
		ID:                 mon.ID.String(),
		Url:                mon.Url,
		AlertEmail:         mon.AlertEmail,
		IntervalSec:        mon.IntervalSec,
		TimeoutSec:         mon.TimeoutSec,
		LatencyThresholdMs: mon.LatencyThresholdMs,
		ExpectedStatus:     mon.ExpectedStatus,
		Enabled:            mon.Enabled,
	})
}

func (h *Handler) GetAllMonitors(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.monitor.get_all_monitor"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit, err := strconv.ParseInt(limitStr, 10, 32)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid input")
		return
	}
	offset, err := strconv.ParseInt(offsetStr, 10, 32)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid input")
		return
	}

	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	monitors, err := h.service.GetAllMonitors(ctx, tm.TeamID, int32(limit), int32(offset))
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("retrieving all monitors error")
		utils.FromAppError(w, reqID, err)
		return
	}

	m := make([]GetMonitorResponse, 0, len(monitors))
	for i := range monitors {
		mon := &monitors[i]
		m = append(m, GetMonitorResponse{
			ID:                 mon.ID.String(),
			Url:                mon.Url,
			IntervalSec:        mon.IntervalSec,
			TimeoutSec:         mon.TimeoutSec,
			LatencyThresholdMs: mon.LatencyThresholdMs,
			ExpectedStatus:     mon.ExpectedStatus,
			Enabled:            mon.Enabled,
			AlertEmail:         mon.AlertEmail,
		})
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "monitors retrieved", GetAllMonitorsResponse{
		TeamID:   tm.TeamID.String(),
		Limit:    int32(limit),
		Offset:   int32(offset),
		Monitors: m,
	})
}

func (h *Handler) DeleteMonitor(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.monitor.delete_monitor"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	monitorID, err := uuid.Parse(chi.URLParam(r, "monitorID"))
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid input")
		return
	}

	if err := h.service.DeleteMonitor(ctx, tm.TeamID, monitorID); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("delete monitor error")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "monitor deleted successfully", "")
}

func (h *Handler) UpdateMonitorStatus(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.monitor.update_monitor_status"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	monitorID, err := uuid.Parse(chi.URLParam(r, "monitorID"))
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid input")
		return
	}

	var req UpdateMonitorStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid input")
		return
	}

	if _, err := h.service.UpdateMonitorStatus(ctx, tm.TeamID, monitorID, *req.Enable); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("updating monitor status error")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "monitor status updated successfully", "ok")
}
