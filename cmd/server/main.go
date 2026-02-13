package main

import (
	"context"
	"os/signal"
	"syscall"
	"time"

	"github.com/alkush-pipania/sofon/config"
	"github.com/alkush-pipania/sofon/internals/app"
	"github.com/alkush-pipania/sofon/internals/server"
	"github.com/alkush-pipania/sofon/pkg/logger"
)

func main() {
	cfg, err := config.LoadConfig("env.yaml")

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log := logger.Init(cfg)
	log.Info().Msg("logger Initialized")

	container, err := app.NewContainer(ctx, cfg, log)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize dependencies")
	}
	log.Info().Msg("dependencies initialized")

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
