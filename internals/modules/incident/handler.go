package incident

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type Handler struct {
	service *Service
	logger  *zerolog.Logger
}

func NewHandler(service *Service, logger *zerolog.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

func (h *Handler) ListIncidents(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.incident.list_incidents"

	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	limit := int32(20)
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || l <= 0 || l > 100 {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid limit")
			return
		}
		limit = int32(l)
	}

	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status == "" {
		status = "all"
	}
	if status != "all" && status != "active" && status != "resolved" {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid status")
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("q"))

	var from *time.Time
	if fromStr := strings.TrimSpace(r.URL.Query().Get("from")); fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid from")
			return
		}
		from = &t
	}

	var to *time.Time
	if toStr := strings.TrimSpace(r.URL.Query().Get("to")); toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid to")
			return
		}
		to = &t
	}

	if from != nil && to != nil && from.After(*to) {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "`from` must be before `to`")
		return
	}

	var monitorID *uuid.UUID
	if monitorIDStr := strings.TrimSpace(r.URL.Query().Get("monitor_id")); monitorIDStr != "" {
		id, err := uuid.Parse(monitorIDStr)
		if err != nil {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid monitor_id")
			return
		}
		monitorID = &id
	}

	var cursor *Cursor
	if cursorStr := strings.TrimSpace(r.URL.Query().Get("cursor")); cursorStr != "" {
		decoded, err := DecodeCursor(cursorStr)
		if err != nil {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid cursor")
			return
		}
		if _, err := uuid.Parse(decoded.IncidentID); err != nil {
			utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid cursor")
			return
		}
		cursor = decoded
	}

	page, err := h.service.ListByTeamID(ctx, tm.TeamID, ListIncidentsOptions{
		Limit:  limit,
		Cursor: cursor,
		Filters: ListFilters{
			Status:    status,
			Query:     query,
			MonitorID: monitorID,
			From:      from,
			To:        to,
		},
	})
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("failed to list incidents")
		utils.FromAppError(w, reqID, err)
		return
	}

	items := make([]IncidentResponse, 0, len(page.Incidents))
	for i := range page.Incidents {
		items = append(items, toIncidentResponse(&page.Incidents[i]))
	}

	applied := AppliedFilters{
		Status: page.Applied.Status,
		Query:  page.Applied.Query,
		From:   toRFC3339Ptr(page.Applied.From),
		To:     toRFC3339Ptr(page.Applied.To),
	}
	if page.Applied.MonitorID != nil {
		v := page.Applied.MonitorID.String()
		applied.MonitorID = &v
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "incidents retrieved", ListIncidentsResponse{
		Limit:          page.Limit,
		HasMore:        page.HasMore,
		NextCursor:     page.NextCursor,
		AppliedFilters: applied,
		Incidents:      items,
	})
}

func (h *Handler) GetIncident(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.incident.get_incident"

	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	tm, ok := middle.TeamMemberFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusForbidden, reqID, apperror.Forbidden, "team access required")
		return
	}

	incidentID, err := uuid.Parse(chi.URLParam(r, "incidentID"))
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid incident id")
		return
	}

	inc, err := h.service.GetByIDAndTeamID(ctx, incidentID, tm.TeamID)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("failed to get incident")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "incident retrieved", toIncidentResponse(&inc))
}

func toIncidentResponse(i *Incident) IncidentResponse {
	start := i.StartTime.UTC().Format(time.RFC3339)
	created := i.CreatedAt.UTC().Format(time.RFC3339)

	var end *string
	if i.EndTime != nil {
		v := i.EndTime.UTC().Format(time.RFC3339)
		end = &v
	}

	var latestAlert *LatestAlertResponse
	if i.AlertStatus != "" || i.AlertEmail != "" || i.AlertSentAt != nil {
		var sentAt *string
		if i.AlertSentAt != nil {
			v := i.AlertSentAt.UTC().Format(time.RFC3339)
			sentAt = &v
		}
		latestAlert = &LatestAlertResponse{
			Status: i.AlertStatus,
			Email:  i.AlertEmail,
			SentAt: sentAt,
		}
	}

	return IncidentResponse{
		ID:          i.ID,
		MonitorID:   i.MonitorID,
		MonitorURL:  i.MonitorURL,
		StartTime:   start,
		EndTime:     end,
		Alerted:     i.Alerted,
		HTTPStatus:  i.HTTPStatus,
		LatencyMs:   i.LatencyMs,
		CreatedAt:   created,
		IsActive:    i.IsActive,
		DurationSec: i.DurationSec,
		LatestAlert: latestAlert,
	}
}

func toRFC3339Ptr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	v := t.UTC().Format(time.RFC3339)
	return &v
}
