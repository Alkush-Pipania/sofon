package team

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

type Team struct {
	ID   int
	Name string
}

type Invitation struct {
	ID         uuid.UUID
	Email      string
	Role       string
	Token      string
	ExpiresAt  time.Time
	AcceptedAt *time.Time
	InvitedBy  uuid.UUID
	CreatedAt  time.Time
}

type Member struct {
	ID        uuid.UUID
	Name      string
	Email     string
	Role      string
	IsActive  bool
	CreatedAt time.Time
}

type CreateInvitationCmd struct {
	Email     string
	Role      string
	InvitedBy uuid.UUID
}

type AcceptInvitationCmd struct {
	Token    string
	Name     string
	Password string
}
