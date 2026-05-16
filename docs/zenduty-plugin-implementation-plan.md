# Implementation Plan: Zenduty Plugin

## What We're Building

A Zenduty notification plugin that fires when a monitor goes DOWN and auto-resolves
the Zenduty incident when the monitor recovers. The architecture mirrors the existing
Resend plugin pattern but with one key difference: Zenduty requires both a DOWN call
AND a RESOLVED call, and we already push both `AlertTypeDown` and `AlertTypeRecovered`
events — so the wiring is already in place.

---

## Files to Change / Create

### Legend
- `[NEW]` — new file to create
- `[MOD]` — existing file to modify

---

## Backend

---

### 1. `internals/modules/plugin/domain.go` — `[MOD]`

Add the new plugin type constant.

```go
// existing
const PluginTypeResend PluginType = "resend"

// add
const PluginTypeZenduty PluginType = "zenduty"
```

---

### 2. `internals/modules/alert/models.go` — `[MOD]`

Add the Zenduty config struct (mirrors `ResendEmailConfig`):

```go
// ZendutyConfig holds what the alert service needs from a Zenduty plugin.
type ZendutyConfig struct {
    IntegrationURL string // full webhook URL from Zenduty dashboard
}
```

---

### 3. `internals/modules/alert/service.go` — `[MOD]`

**3a. Extend `PluginConfigGetter` interface** — add Zenduty getter:

```go
type PluginConfigGetter interface {
    GetResendConfig(ctx context.Context, teamID uuid.UUID) (ResendEmailConfig, bool, error)
    GetZendutyConfig(ctx context.Context, teamID uuid.UUID) (ZendutyConfig, bool, error)
}
```

**3b. Extend `PluginCacheClient` interface** — add Zenduty cache methods:

```go
type PluginCacheClient interface {
    // resend (existing)
    GetCachedResendConfig(ctx context.Context, teamID uuid.UUID) (ResendEmailConfig, bool)
    SetCachedResendConfig(ctx context.Context, teamID uuid.UUID, cfg ResendEmailConfig, ttl time.Duration) error

    // zenduty (new)
    GetCachedZendutyConfig(ctx context.Context, teamID uuid.UUID) (ZendutyConfig, bool)
    SetCachedZendutyConfig(ctx context.Context, teamID uuid.UUID, cfg ZendutyConfig, ttl time.Duration) error
}
```

**3c. Update `processAlert`** — fan out to all configured plugins:

Current `processAlert` only handles Resend. Replace/extend to call both:

```go
func (s *AlertService) processAlert(event AlertEvent) {
    if event.Type == "" {
        event.Type = AlertTypeDown
    }

    ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
    defer cancel()

    // fire each plugin handler independently; one failure doesn't block others
    s.handleResend(ctx, event)
    s.handleZenduty(ctx, event)
}
```

Extract existing Resend logic into `handleResend(ctx, event)` method.
Add new `handleZenduty(ctx, event)` method.

**3d. Add `handleZenduty` method:**

```go
func (s *AlertService) handleZenduty(ctx context.Context, event AlertEvent) {
    // 1. load config from cache → DB
    cfg, ok := s.redisCache.GetCachedZendutyConfig(ctx, event.TeamID)
    if !ok {
        dbCfg, found, err := s.pluginRepo.GetZendutyConfig(ctx, event.TeamID)
        if err != nil {
            s.logger.Error().Err(err).Str("team_id", event.TeamID.String()).
                Msg("zenduty: failed to load plugin config")
            return
        }
        if !found {
            s.logger.Debug().Str("team_id", event.TeamID.String()).
                Msg("zenduty: plugin not configured or disabled, skipping")
            return
        }
        cfg = dbCfg
        _ = s.redisCache.SetCachedZendutyConfig(ctx, event.TeamID, cfg, 5*time.Minute)
    }

    // 2. build and send event
    if err := s.sendZendutyEvent(ctx, cfg, event); err != nil {
        s.logger.Error().Err(err).
            Str("incident_id", event.IncidentID.String()).
            Msg("zenduty: failed to send event")
        return
    }

    s.logger.Info().
        Str("incident_id", event.IncidentID.String()).
        Str("alert_type", string(event.Type)).
        Msg("zenduty: event sent successfully")
}
```

**3e. Add `sendZendutyEvent` method:**

```go
func (s *AlertService) sendZendutyEvent(ctx context.Context, cfg ZendutyConfig, event AlertEvent) error {
    alertType := "critical"
    message := fmt.Sprintf("%s is DOWN", event.MonitorURL)
    summary := event.Reason
    if event.Type == AlertTypeRecovered {
        alertType = "resolved"
        message = fmt.Sprintf("%s is UP", event.MonitorURL)
        summary = "Monitor has recovered and is responding normally"
    }

    payload := map[string]any{
        "alert_type": alertType,
        "message":    message,
        "summary":    summary,
        "entity_id":  event.MonitorID.String(), // dedup key — MUST be consistent
        "payload": map[string]string{
            "status_code": fmt.Sprintf("%d", event.StatusCode),
            "monitor_url": event.MonitorURL,
            "latency_ms":  fmt.Sprintf("%d", event.LatencyMs),
            "incident_id": event.IncidentID.String(),
        },
        "urls": []map[string]string{
            {"link_url": event.MonitorURL, "link_text": "Affected URL"},
        },
    }

    body, err := json.Marshal(payload)
    if err != nil {
        return err
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.IntegrationURL, bytes.NewReader(body))
    if err != nil {
        return err
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 300 {
        raw, _ := io.ReadAll(resp.Body)
        return fmt.Errorf("zenduty returned %d: %s", resp.StatusCode, string(raw))
    }
    return nil
}
```

---

### 4. `internals/modules/plugin/repository.go` — `[MOD]`

Add `GetZendutyConfig` method (mirrors `GetResendConfig`):

```go
// GetZendutyConfig satisfies alert.PluginConfigGetter interface.
func (r *Repository) GetZendutyConfig(ctx context.Context, teamID uuid.UUID) (alert.ZendutyConfig, bool, error) {
    const op = "repo.plugin.get_zenduty_config"

    row, err := r.querier.GetPlugin(ctx, db.GetPluginParams{
        TeamID:     utils.ToPgUUID(teamID),
        PluginType: string(PluginTypeZenduty),
    })
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return alert.ZendutyConfig{}, false, nil
        }
        return alert.ZendutyConfig{}, false, utils.WrapRepoError(op, err, r.log)
    }

    if !row.Enabled {
        return alert.ZendutyConfig{}, false, nil
    }

    configMap, err := r.decrypt(row.ConfigEnc, op)
    if err != nil {
        return alert.ZendutyConfig{}, false, err
    }

    return alert.ZendutyConfig{
        IntegrationURL: configMap["integration_url"],
    }, true, nil
}
```

---

### 5. `pkg/redis/plugin_cache.go` — `[MOD]`

Add Zenduty cache methods (mirrors Resend cache methods):

```go
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
```

---

### 6. No DB migration needed

The `plugins` table already stores any plugin type as a generic `TEXT` column
(`plugin_type`) with an encrypted JSON blob (`config_enc`). Zenduty just becomes
another row with `plugin_type = 'zenduty'` and `config_enc` = encrypted
`{"integration_url": "https://events.zenduty.com/..."}`.

No new SQL queries needed either — `UpsertPlugin`, `GetPlugin`, `ListPlugin`,
`DeletePlugin` all work generically.

---

## Frontend

---

### 7. `web/src/app/(main)/plugins/content.tsx` — `[MOD]`

Add Zenduty to `PLUGIN_REGISTRY`. Import a suitable icon from `lucide-react`
(e.g., `BellRing` or `Siren`):

```tsx
import { Mail, BellRing } from "lucide-react";

const PLUGIN_REGISTRY: PluginDef[] = [
    {
        type: "resend",
        name: "Resend Email",
        description: "Send incident alert emails via the Resend API.",
        icon: Mail,
        fields: [
            { key: "api_key",       label: "API Key",       placeholder: "re_xxxxxxxxxxxxxxxxxxxx", type: "password" },
            { key: "sender_email",  label: "Sender Email",  placeholder: "alerts@yourdomain.com",  type: "email",
              hint: "Must be a verified sender in your Resend account." },
        ],
    },
    {
        type: "zenduty",
        name: "Zenduty",
        description: "Create and auto-resolve Zenduty incidents when monitors go down.",
        icon: BellRing,
        fields: [
            {
                key: "integration_url",
                label: "Integration Webhook URL",
                placeholder: "https://events.zenduty.com/integration/.../generic/.../",
                hint: "Found in Zenduty → Service → Integrations → Generic Integration → Configure.",
            },
        ],
    },
];
```

That's **the only frontend change** — the existing `ConfigDialog`, `PluginStatusBadge`,
table row, save/delete logic all work generically from the registry.

---

## Build Verification Order

1. `go build ./...` — catches interface mismatches (PluginConfigGetter, PluginCacheClient)
2. Manual test:
   - Configure Zenduty plugin via Plugins page
   - Trigger a monitor failure → check Zenduty dashboard for new incident
   - Wait for monitor to recover → check incident auto-resolves in Zenduty

---

## Summary Table

| File | Type | What Changes |
|------|------|-------------|
| `internals/modules/plugin/domain.go` | MOD | Add `PluginTypeZenduty = "zenduty"` constant |
| `internals/modules/alert/models.go` | MOD | Add `ZendutyConfig` struct |
| `internals/modules/alert/service.go` | MOD | Extend interfaces; add `handleZenduty`, `sendZendutyEvent`; refactor `processAlert` to fan-out |
| `internals/modules/plugin/repository.go` | MOD | Add `GetZendutyConfig` method |
| `pkg/redis/plugin_cache.go` | MOD | Add `GetCachedZendutyConfig`, `SetCachedZendutyConfig`, `DelCachedZendutyConfig` |
| `web/src/app/(main)/plugins/content.tsx` | MOD | Add zenduty entry to `PLUGIN_REGISTRY` |

**No new DB migration. No new SQL queries. No new files.**
The only genuinely new logic is `sendZendutyEvent` — everything else is extending
existing patterns that already exist for Resend.
