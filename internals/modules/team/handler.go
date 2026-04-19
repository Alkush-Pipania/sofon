package team

import (
	"encoding/json"
	"net/http"

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

func (h *Handler) GetTeam(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.get_team"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	team, err := h.service.GetTeam(ctx)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "team retrieved", TeamResponse{Name: team.Name})
}

func (h *Handler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.update_team"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	var req UpdateTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	if err := h.service.UpdateTeamName(ctx, req.Name); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "team updated", TeamResponse{Name: req.Name})
}

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.list_members"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	members, err := h.service.ListMembers(ctx)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	res := make([]MemberResponse, len(members))
	for i, m := range members {
		res[i] = MemberResponse{
			ID:        m.ID.String(),
			Name:      m.Name,
			Email:     m.Email,
			Role:      m.Role,
			IsActive:  m.IsActive,
			CreatedAt: m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "members retrieved", res)
}

func (h *Handler) SetMemberActive(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.set_member_active"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	claims, ok := middle.UserFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}
	callerID, err := uuid.Parse(claims.UserID)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}

	targetID, err := uuid.Parse(chi.URLParam(r, "memberID"))
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid member id")
		return
	}

	var body struct {
		Active bool `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	if err := h.service.SetMemberActive(ctx, targetID, callerID, body.Active); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "member status updated", struct{}{})
}

func (h *Handler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.create_invitation"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	claims, ok := middle.UserFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}
	inviterID, err := uuid.Parse(claims.UserID)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}

	var req InviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	inv, err := h.service.CreateInvitation(ctx, CreateInvitationCmd{
		Email:     req.Email,
		Role:      req.Role,
		InvitedBy: inviterID,
	})
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	res := InvitationResponse{
		ID:        inv.ID.String(),
		Email:     inv.Email,
		Role:      inv.Role,
		Link:      h.service.InviteLink(inv.Token),
		ExpiresAt: inv.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		Accepted:  inv.AcceptedAt != nil,
		CreatedAt: inv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	utils.WriteJSON(w, http.StatusCreated, reqID, "invitation created", res)
}

func (h *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.list_invitations"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	invs, err := h.service.ListInvitations(ctx)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	res := make([]InvitationResponse, len(invs))
	for i, inv := range invs {
		res[i] = InvitationResponse{
			ID:        inv.ID.String(),
			Email:     inv.Email,
			Role:      inv.Role,
			Link:      h.service.InviteLink(inv.Token),
			ExpiresAt: inv.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
			Accepted:  inv.AcceptedAt != nil,
			CreatedAt: inv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "invitations retrieved", res)
}

func (h *Handler) RevokeInvitation(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.revoke_invitation"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	idStr := chi.URLParam(r, "invitationID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid invitation id")
		return
	}

	if err := h.service.RevokeInvitation(ctx, id); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "invitation revoked", struct{}{})
}

func (h *Handler) GetInvitationByToken(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.get_invitation_by_token"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	token := chi.URLParam(r, "token")
	inv, err := h.service.GetInvitationByToken(ctx, token)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	teamInfo, _ := h.service.GetTeam(ctx)

	res := struct {
		Email     string `json:"email"`
		Role      string `json:"role"`
		TeamName  string `json:"team_name"`
		ExpiresAt string `json:"expires_at"`
	}{
		Email:     inv.Email,
		Role:      inv.Role,
		TeamName:  teamInfo.Name,
		ExpiresAt: inv.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "invitation retrieved", res)
}

func (h *Handler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	const op = "handler.team.accept_invitation"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	var req AcceptInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	if err := h.service.AcceptInvitation(ctx, AcceptInvitationCmd{
		Token:    req.Token,
		Name:     req.Name,
		Password: req.Password,
	}); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, reqID, "invitation accepted", struct{}{})
}
