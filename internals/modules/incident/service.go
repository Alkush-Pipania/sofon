package incident

import (
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListByTeamID(ctx context.Context, teamID uuid.UUID, opts ListIncidentsOptions) (ListIncidentsPage, error) {
	incidents, hasMore, err := s.repo.ListByTeamID(ctx, teamID, opts)
	if err != nil {
		return ListIncidentsPage{}, err
	}

	var nextCursor *string
	if hasMore && len(incidents) > 0 {
		last := incidents[len(incidents)-1]
		cursor, err := EncodeCursor(Cursor{
			StartTime:  last.StartTime,
			IncidentID: last.ID,
		})
		if err != nil {
			return ListIncidentsPage{}, err
		}
		nextCursor = &cursor
	}

	return ListIncidentsPage{
		Incidents:  incidents,
		HasMore:    hasMore,
		NextCursor: nextCursor,
		Applied:    opts.Filters,
		Limit:      opts.Limit,
	}, nil
}

func (s *Service) GetByIDAndTeamID(ctx context.Context, incidentID uuid.UUID, teamID uuid.UUID) (Incident, error) {
	return s.repo.GetByIDAndTeamID(ctx, incidentID, teamID)
}
