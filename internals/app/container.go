package app

import (
	"context"

	"github.com/alkush-pipania/sofon/config"
	middle "github.com/alkush-pipania/sofon/internals/middleware"
	"github.com/alkush-pipania/sofon/internals/modules/alert"
	"github.com/alkush-pipania/sofon/internals/modules/executor"
	"github.com/alkush-pipania/sofon/internals/modules/monitor"
	"github.com/alkush-pipania/sofon/internals/modules/result"
	"github.com/alkush-pipania/sofon/internals/modules/scheduler"
	"github.com/alkush-pipania/sofon/internals/modules/user"
	"github.com/alkush-pipania/sofon/internals/security"
	"github.com/alkush-pipania/sofon/pkg/redis"
	"github.com/go-playground/validator/v10"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

type Container struct {
	DB             *pgxpool.Pool
	RedisClient    redis.Client
	Logger         *zerolog.Logger
	userSvc        *user.Service
	userHandler    *user.Handler
	monitorHandler *monitor.Handler
	authMW         *middle.AuthMiddleware
	Scheduler      *scheduler.Scheduler
	Executor       *executor.Executor
	ResultPro      *result.ResultProcessor
	AlertSvc       *alert.AlertService
	JobChan        chan scheduler.JobPayload
	ResultChan     chan executor.HTTPResult
	AlertChan      chan alert.AlertEvent
}

func NewContainer(ctx context.Context, cfg *config.Config, logger *zerolog.Logger, db *pgxpool.Pool) (*Container, error) {
	redisClient, err := redis.New(&cfg.Redis)
	if err != nil {
		return nil, err
	}
	v := validator.New()
	tokenSvc := security.NewTokenService(&cfg.Auth)

	jobChan := make(chan scheduler.JobPayload, cfg.App.JobChannelSize)      // specify channel size in config
	resultChan := make(chan executor.HTTPResult, cfg.App.ResultChannelSize) // specify channel size in config
	alertChan := make(chan alert.AlertEvent, cfg.App.AlertChannelSize)      // specify channel size in config

	monitorRepo := monitor.NewRepository(db, logger)
	incidentRepo := result.NewMonitorIncidentRepo(db, logger)
	userRepo := user.NewRepository(db, logger)

	userService := user.NewService(userRepo, tokenSvc)
	monitorSvc := monitor.NewService(monitorRepo, redisClient, userService, logger)

	sch := scheduler.NewScheduler(ctx, &cfg.Scheduler, jobChan, redisClient, logger)
	exec := executor.NewExecutor(ctx, &cfg.Executor, jobChan, resultChan, monitorSvc, logger)
	resultPro := result.NewResultProcessor(ctx, &cfg.ResultProcessor, redisClient, resultChan, incidentRepo, monitorSvc, alertChan, logger)
	alertSvc := alert.NewAlertService(&cfg.Alert, alertChan, logger)

	monitorHandler := monitor.NewHandler(monitorSvc, v, logger)
	userHandler := user.NewHandler(userService, v, logger)

	authMW := middle.NewAuthMiddleware(tokenSvc)
	return &Container{
		RedisClient:    *redisClient,
		Logger:         logger,
		DB:             db,
		userSvc:        userService,
		userHandler:    userHandler,
		authMW:         authMW,
		monitorHandler: monitorHandler,
		Scheduler:      sch,
		Executor:       exec,
		ResultPro:      resultPro,
		AlertSvc:       alertSvc,
		JobChan:        jobChan,
		ResultChan:     resultChan,
		AlertChan:      alertChan,
	}, nil

}

func (c *Container) Shutdown() error {
	close(c.JobChan)

	c.Executor.Stop()

	close(c.ResultChan)

	c.ResultPro.WorkersClosingWait()

	close(c.AlertChan)

	c.AlertSvc.WorkerClosingWait()

	// close redis
	err := c.RedisClient.Close()
	if err != nil {
		return err
	}
	return nil
}
