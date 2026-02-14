package main

import (
	"context"
	"os/signal"
	"syscall"
	"time"

	"github.com/alkush-pipania/sofon/config"
	"github.com/alkush-pipania/sofon/internals/app"
	"github.com/alkush-pipania/sofon/internals/server"
	"github.com/alkush-pipania/sofon/pkg/db"
	"github.com/alkush-pipania/sofon/pkg/logger"
)

func main() {
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log := logger.Init(cfg)
	log.Info().Msg("logger Initialized")

	dbPool, err := db.ConnectToDB(ctx, &cfg.DB, log)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize db pool")
	}
	log.Info().Msg("database pool initialized")
	defer dbPool.Close()

	container, err := app.NewContainer(ctx, cfg, log, dbPool)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize dependencies")
	}
	log.Info().Msg("dependencies initialized")

	container.Scheduler.StartScheduler()

	container.Executor.StartWorkers()

	container.ResultPro.StartResultProcessor()

	container.AlertSvc.Start()

	log.Info().Msg("all svc initialized")

	router := app.NewRouter(container)
	log.Info().Msg("routes registered")

	srv := server.New(router, cfg.Port, log)
	srv.Start()

	<-ctx.Done()
	log.Info().Msg("shutdown signal received")

	if err := srv.Shutdown(context.Background()); err != nil {
		log.Error().Err(err).Msg("server shutdown failed")
	}

	_, cancle := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancle()

	if err := container.Shutdown(); err != nil {
		log.Error().Err(err).Msg("dependecies shutdown failed")
	}

	log.Info().Msg("graceful shutdown complete")
}
