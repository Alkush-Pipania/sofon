package user

import (
	"encoding/json"
	"net/http"

	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/alkush-pipania/sofon/pkg/apperror"
	"github.com/alkush-pipania/sofon/pkg/utils"
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

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.user.register"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	// valideate request body
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	id, err := h.service.Register(ctx, CreateUserCmd{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: req.Password,
	})
	if err != nil {
		h.logger.Error().
			Str("op", op).
			Str("req_id", reqID).
			Err(err).
			Msg("registration error")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, reqID, "user registered", RegisterResponse{UserID: id.String()})
}

func (h *Handler) LogIn(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.user.login"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	var req LogInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	// valideate request body
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	res, err := h.service.LogIn(ctx, LogInUserCmd{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		h.logger.Error().
			Str("op", op).
			Str("req_id", reqID).
			Err(err).
			Msg("login error")
		utils.FromAppError(w, reqID, err)
		return
	}
	result := LogInResponse{
		UserID:      res.UserID.String(),
		AccessToken: res.AccessToken,
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "user registered", result)
}

func (h *Handler) SetupStatus(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.user.setup_status"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	enabled, err := h.service.SetupStatus(ctx)
	if err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Msg("setup status error")
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "setup status", SetupStatusResponse{RegistrationsEnabled: enabled})
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.user.update_profile"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	reqClaims, ok := middle.UserFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}
	userID, err := uuid.Parse(reqClaims.UserID)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	if err := h.service.UpdateProfile(ctx, userID, req.Name); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "profile updated", struct{}{})
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.user.change_password"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	reqClaims, ok := middle.UserFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}
	userID, err := uuid.Parse(reqClaims.UserID)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "unauthorised")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}
	if err := h.validator.Struct(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "invalid request body")
		return
	}

	if req.NewPassword != req.ConfirmPassword {
		utils.WriteError(w, http.StatusBadRequest, reqID, apperror.InvalidInput, "new passwords do not match")
		return
	}

	if err := h.service.ChangePassword(ctx, userID, req.CurrentPassword, req.NewPassword); err != nil {
		h.logger.Error().Str("op", op).Str("req_id", reqID).Err(err).Send()
		utils.FromAppError(w, reqID, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "password changed", struct{}{})
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	const op string = "handler.user.get_profile"
	ctx := r.Context()
	reqID := middleware.GetReqID(ctx)

	reqClaims, ok := middle.UserFromContext(ctx)
	if !ok {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "user unauthorised")
		return
	}
	userID, err := uuid.Parse(reqClaims.UserID)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, reqID, apperror.Unauthorised, "user unauthorised")
		return
	}

	user, err := h.service.GetProfile(ctx, userID)
	if err != nil {
		h.logger.Error().
			Str("op", op).
			Str("req_id", reqID).
			Err(err).
			Msg("login error")
		utils.FromAppError(w, reqID, err)
		return
	}
	u := GetProfileResponse{
		ID:            user.ID.String(),
		Name:          user.Name,
		Email:         user.Email,
		MonitorsCount: user.MonitorsCount,
		IsPaidUser:    user.IsPaidUser,
	}

	utils.WriteJSON(w, http.StatusOK, reqID, "profile retrived", u)
}
