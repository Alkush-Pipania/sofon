package config

import (
	"errors"
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/spf13/viper"
)

func LoadConfig(path string) (*Config, error) {
	v := viper.New()

	setDefaults(v)

	v.SetConfigFile(path)
	v.SetConfigType("yaml")

	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	// Validate
	if err := validateConfig(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil

}

func setDefaults(v *viper.Viper) {
	v.SetDefault("env", "development")
	v.SetDefault("service_name", "monitor-service")
	v.SetDefault("port", "8080")

	// Auth
	v.SetDefault("auth.secret", "my_secret")
	v.SetDefault("auth.token_ttl", "30m")

	// App channels
	v.SetDefault("app.job_channel_size", 500)
	v.SetDefault("app.result_channel_size", 500)
	v.SetDefault("app.alert_channel_size", 500)

	// Scheduler
	v.SetDefault("scheduler.interval", "30s")
	v.SetDefault("scheduler.batch_size", 100)

	// Executor
	v.SetDefault("executor.worker_count", 20)
	v.SetDefault("executor.http_semaphore_count", 100)

	// Alert
	v.SetDefault("alert.worker_count", 10)
	v.SetDefault("alert.owner_email", "admin@example.com")
	v.SetDefault("alert.access_key", "changeme")

	// Result Processor
	v.SetDefault("result_processor.success_worker_count", 10)
	v.SetDefault("result_processor.success_channel_size", 500)
	v.SetDefault("result_processor.failure_worker_count", 10)
	v.SetDefault("result_processor.failure_channel_size", 500)

	// Redis
	v.SetDefault("redis.url", "redis://localhost:6379")
	v.SetDefault("redis.dial_timeout", "5s")
	v.SetDefault("redis.read_timeout", "3s")
	v.SetDefault("redis.write_timeout", "3s")
	v.SetDefault("redis.pool_size", 50)
	v.SetDefault("redis.min_idle_conns", 10)
	v.SetDefault("redis.conn_max_lifetime", "30m")
	v.SetDefault("redis.conn_max_idle_time", "10m")

	// DB
	v.SetDefault("db.url", "postgres://postgres:postgres@localhost:5432/sofon?sslmode=disable")
	v.SetDefault("db.max_open_conns", 25)
	v.SetDefault("db.min_idle_conns", 5)
	v.SetDefault("db.conn_max_lifetime", "30m")
	v.SetDefault("db.conn_max_idle_time", "10m")
	v.SetDefault("db.health_timeout", "5s")
}

func validateConfig(cfg *Config) error {

	validate := validator.New()

	if err := validate.Struct(cfg); err != nil {
		var ve validator.ValidationErrors
		if errors.As(err, &ve) {
			return formatValidationErrors(ve)
		}
		return err
	}
	return nil
}

func formatValidationErrors(ve validator.ValidationErrors) error {
	var sb strings.Builder
	sb.WriteString("config validation failed:\n")

	for _, fe := range ve {
		fmt.Fprintf(&sb, "- field '%s' failed on '%s'\n", fe.Namespace(), fe.Tag())
	}
	return errors.New(sb.String())
}
