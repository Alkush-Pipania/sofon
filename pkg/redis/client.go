package redis

import (
	"context"
	"time"

	"github.com/alkush-pipania/sofon/config"
	"github.com/redis/go-redis/v9"
)

var (
	ErrKeyNotFound = redis.Nil
)

type Client struct {
	rdb *redis.Client
}

func New(redisCfg *config.RedisConfig) (*Client, error) {
	opt, err := redis.ParseURL(redisCfg.URL)
	if err != nil {
		return nil, err
	}

	opt.DialTimeout = redisCfg.DialTimeout
	opt.ReadTimeout = redisCfg.ReadTimeout
	opt.WriteTimeout = redisCfg.WriteTimeout

	opt.PoolSize = redisCfg.PoolSize
	opt.MinIdleConns = redisCfg.MinIdleConns

	opt.ConnMaxLifetime = redisCfg.ConnMaxLifetime
	opt.ConnMaxIdleTime = redisCfg.ConnMaxIdleTime

	rdb := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Client{rdb: rdb}, nil
}

func (c *Client) Close() error {
	return c.rdb.Close()
}
