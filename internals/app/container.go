package app

import (
	"context"

	"github.com/alkush-pipania/sofon/config"
	"github.com/alkush-pipania/sofon/pkg/redis"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

type Container struct {
	DB          *pgxpool.Pool
	RedisClient redis.Client
	Logger      *zerolog.Logger
}

func NewContainer(ctx context.Context, cfg *config.Config, logger *zerolog.Logger) (*Container, error) {
	redisClient, err := redis.New(&cfg.Redis)
	if err != nil {
		return nil, err
	}
	return &Container{
		RedisClient: *redisClient,
		Logger:      logger,
	}, nil

}

func (c *Container) Shutdown() error {
	return nil
}
