package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/alkush-pipania/sofon/internals/modules/alert"
	"github.com/google/uuid"
)

func (c *Client) GetCachedResendConfig(ctx context.Context, teamID uuid.UUID) (alert.ResendEmailConfig, bool) {
	key := fmt.Sprintf("plugin:resend:%s", teamID.String())
	raw, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return alert.ResendEmailConfig{}, false
	}
	var cfg alert.ResendEmailConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return alert.ResendEmailConfig{}, false
	}
	return cfg, true
}

func (c *Client) SetCachedResendConfig(ctx context.Context, teamID uuid.UUID, cfg alert.ResendEmailConfig, ttl time.Duration) error {
	key := fmt.Sprintf("plugin:resend:%s", teamID.String())
	b, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, key, b, ttl).Err()
}

func (c *Client) DelCachedResendConfig(ctx context.Context, teamID uuid.UUID) error {
	key := fmt.Sprintf("plugin:resend:%s", teamID.String())
	return c.rdb.Del(ctx, key).Err()
}

func (c *Client) GetCachedZendutyConfig(ctx context.Context, teamID uuid.UUID) (alert.ZendutyConfig, bool) {
	key := fmt.Sprintf("plugin:zenduty:%s", teamID.String())
	raw, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return alert.ZendutyConfig{}, false
	}
	var cfg alert.ZendutyConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return alert.ZendutyConfig{}, false
	}
	return cfg, true
}

func (c *Client) SetCachedZendutyConfig(ctx context.Context, teamID uuid.UUID, cfg alert.ZendutyConfig, ttl time.Duration) error {
	key := fmt.Sprintf("plugin:zenduty:%s", teamID.String())
	b, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, key, b, ttl).Err()
}

func (c *Client) DelCachedZendutyConfig(ctx context.Context, teamID uuid.UUID) error {
	key := fmt.Sprintf("plugin:zenduty:%s", teamID.String())
	return c.rdb.Del(ctx, key).Err()
}
