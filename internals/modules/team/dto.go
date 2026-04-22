package team

type CreateTeamRequest struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type UpdateTeamRequest struct {
	Name string `json:"name" validate:"required,min=1,max=100"`
}

type InviteMemberRequest struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"required,oneof=member admin owner"`
}

type AcceptInvitationRequest struct {
	Token    string `json:"token" validate:"required"`
	Name     string `json:"name" validate:"required,min=2,max=100"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

type TeamResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

type MemberResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
}

type InvitationResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	Link      string `json:"link"`
	ExpiresAt string `json:"expires_at"`
	Accepted  bool   `json:"accepted"`
	CreatedAt string `json:"created_at"`
}
