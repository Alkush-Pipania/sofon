package user

type GetProfileResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	MonitorsCount int32  `json:"monitors_count"`
	IsPaidUser    bool   `json:"is_paid_user"`
}

type RegisterRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=100"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

type RegisterResponse struct {
	UserID string `json:"user_id"`
}

type LogInRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LogInResponse struct {
	UserID      string `json:"user_id"`
	AccessToken string `json:"access_token"`
}
