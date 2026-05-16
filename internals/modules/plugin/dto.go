package plugin

type UpsertPluginRequest struct {
	Enabled bool              `json:"enabled"`
	Config  map[string]string `json:"config"`
}

type PluginResponse struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Enabled   bool              `json:"enabled"`
	Config    map[string]string `json:"config,omitempty"`
	UpdatedAt string            `json:"updated_at"`
}

type ListPluginsResponse struct {
	Plugins []PluginResponse `json:"plugins"`
}
