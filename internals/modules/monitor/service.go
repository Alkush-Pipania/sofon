package monitor

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type UserService interface {
	IncrementMonitorCount(ctx context.Context, userID uuid.UUID) error
	DecrementMonitorCount(ctx context.Context, userID uuid.UUID) error
}

type Service struct {
	monitorRepo *Repository
	cache       Cache
	userSvc     UserService
	logger      *zerolog.Logger
}

func NewService(monitorRepo *Repository, cache Cache, userSvc UserService, logger *zerolog.Logger) *Service {
	return &Service{
		monitorRepo: monitorRepo,
		userSvc:     userSvc,
		cache:       cache,
		logger:      logger,
	}
}

func (s *Service) CreateMonitor(ctx context.Context, data CreateMonitor) (uuid.UUID, error) {
	const op string = "service.monitor.create_monitor"

	err := s.userSvc.IncrementMonitorCount(ctx, data.UserID)
	if err != nil {
		return uuid.UUID{}, err
	}

	monitorID, err := s.monitorRepo.Create(ctx, data)
	if err != nil {
		return uuid.UUID{}, err
	}

	s.ScheduleMonitor(ctx, monitorID, data.IntervalSec, op)

	return monitorID, nil
}

func (s *Service) GetMonitor(ctx context.Context, teamID uuid.UUID, monitorID uuid.UUID) (Monitor, error) {
	const op string = "service.monitor.get_monitor"

	m, exists := s.cache.GetMonitor(ctx, monitorID)
	if exists && m.TeamID == teamID {
		return m, nil
	}

	mDB, err := s.monitorRepo.Get(ctx, teamID, monitorID)
	if err != nil {
		return Monitor{}, err
	}

	if err := s.cache.SetMonitor(ctx, mDB); err != nil {
		s.logger.Error().
			Str("op", op).
			Err(err).
			Msg("error in setting in cache")
	}

	return mDB, nil
}

func (s *Service) LoadMonitor(ctx context.Context, monitorID uuid.UUID) (Monitor, error) {
	const op string = "service.monitor.load_monitor"

	mDB, err := s.monitorRepo.GetByID(ctx, monitorID)
	if err != nil {
		return Monitor{}, err
	}

	if err := s.cache.SetMonitor(ctx, mDB); err != nil {
		s.logger.Error().
			Str("op", op).
			Err(err).
			Msg("error in setting in cache")
	}

	return mDB, nil
}

func (s *Service) GetAllMonitors(ctx context.Context, teamID uuid.UUID, limit int32, offset int32) ([]Monitor, error) {
	m, err := s.monitorRepo.GetAll(ctx, teamID, limit, offset)
	if err != nil {
		return []Monitor{}, err
	}
	return m, nil
}

func (s *Service) UpdateMonitorStatus(ctx context.Context, teamID, monitorID uuid.UUID, enable bool) (bool, error) {
	const op = "service.monitor.update_status"

	m, err := s.monitorRepo.Get(ctx, teamID, monitorID)
	if err != nil {
		return false, err
	}

	if m.Enabled == enable {
		return true, nil
	}

	if err := s.monitorRepo.SetEnabled(ctx, teamID, monitorID, enable); err != nil {
		return false, err
	}

	if enable {
		s.ScheduleMonitor(ctx, m.ID, m.IntervalSec, op)
	} else {
		s.disableMonitor(ctx, monitorID)
	}

	return true, nil
}

func (s *Service) ScheduleMonitor(ctx context.Context, mID uuid.UUID, intervalSec int32, op string) {
	nextRun := time.Now().Add(time.Duration(intervalSec) * time.Second)

	if err := s.cache.Schedule(ctx, mID.String(), nextRun); err != nil {
		s.logger.Error().
			Str("op", op).
			Err(err).
			Msg("Error in scheduling monitor, after multiple retries, will retry asynchronously")
	}
}

func (s *Service) DeleteMonitor(ctx context.Context, teamID, monitorID uuid.UUID) error {
	const op = "service.monitor.delete_monitor"

	m, err := s.monitorRepo.Get(ctx, teamID, monitorID)
	if err != nil {
		return err
	}

	s.disableMonitor(ctx, monitorID)

	if err := s.monitorRepo.Delete(ctx, teamID, monitorID); err != nil {
		return err
	}

	if err := s.userSvc.DecrementMonitorCount(ctx, m.UserID); err != nil {
		s.logger.Error().Str("op", op).Err(err).Msg("failed to decrement monitor count after delete")
	}

	return nil
}

func (s *Service) disableMonitor(ctx context.Context, monitorID uuid.UUID) {
	_ = s.cache.DelMonitor(ctx, monitorID)
	_ = s.cache.DelSchedule(ctx, monitorID.String())
	_ = s.cache.ClearIncident(ctx, monitorID)
	_ = s.cache.DelStatus(ctx, monitorID)
}
