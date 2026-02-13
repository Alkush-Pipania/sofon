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

	v.SetDefault("auth.secret", "my_secret")
	v.SetDefault("auth.token_ttl", "30m")
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
