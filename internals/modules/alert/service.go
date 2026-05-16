package alert

import (
	"context"
	"fmt"
	"html/template"
	"strings"
	"sync"
	"time"

	"github.com/alkush-pipania/sofon/config"
	resendpkg "github.com/alkush-pipania/sofon/pkg/redis/resend"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

// PluginConfigGetter is satisfied by *plugin.Repository.
// Defined here to avoid importing the plugin package from alert.
type PluginConfigGetter interface {
	GetResendConfig(ctx context.Context, teamID uuid.UUID) (ResendEmailConfig, bool, error)
}

// ResendEmailConfig holds only what the alert service needs from a Resend plugin.
type ResendEmailConfig struct {
	APIKey      string
	SenderEmail string
}

// PluginCacheClient is satisfied by *redis.Client.
type PluginCacheClient interface {
	GetCachedResendConfig(ctx context.Context, teamID uuid.UUID) (ResendEmailConfig, bool)
	SetCachedResendConfig(ctx context.Context, teamID uuid.UUID, cfg ResendEmailConfig, ttl time.Duration) error
}

type AlertService struct {
	workerCount int
	workerWG    sync.WaitGroup

	pluginRepo  PluginConfigGetter
	redisCache  PluginCacheClient
	db          *pgxpool.Pool
	alertChan   chan AlertEvent
	logger      *zerolog.Logger
}

func NewAlertService(
	alertConfig *config.AlertConfig,
	db *pgxpool.Pool,
	pluginRepo PluginConfigGetter,
	redisCache PluginCacheClient,
	alertChan chan AlertEvent,
	logger *zerolog.Logger,
) *AlertService {
	return &AlertService{
		workerCount: alertConfig.WorkerCount,
		pluginRepo:  pluginRepo,
		redisCache:  redisCache,
		db:          db,
		alertChan:   alertChan,
		logger:      logger,
	}
}

func (s *AlertService) Start() {
	s.workerWG.Add(s.workerCount)
	for range s.workerCount {
		go s.handleAlerts()
	}
	s.logger.Info().Msg("Alert workers started")
}

func (s *AlertService) handleAlerts() {
	defer s.workerWG.Done()
	for alert := range s.alertChan {
		s.processAlert(alert)
	}
}

func (s *AlertService) processAlert(event AlertEvent) {
	if event.Type == "" {
		event.Type = AlertTypeDown
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Load Resend config from cache → DB
	resendCfg, ok := s.redisCache.GetCachedResendConfig(ctx, event.TeamID)
	if !ok {
		dbCfg, found, err := s.pluginRepo.GetResendConfig(ctx, event.TeamID)
		if err != nil {
			s.logger.Error().Err(err).Str("team_id", event.TeamID.String()).Msg("failed to load resend plugin config")
			_ = s.persistAlert(event.IncidentID, "", "failed", time.Time{})
			return
		}
		if !found {
			s.logger.Warn().
				Str("incident_id", event.IncidentID.String()).
				Str("team_id", event.TeamID.String()).
				Msg("skipping alert: resend plugin not configured or disabled")
			_ = s.persistAlert(event.IncidentID, "", "skipped_no_plugin", time.Time{})
			return
		}
		resendCfg = ResendEmailConfig{APIKey: dbCfg.APIKey, SenderEmail: dbCfg.SenderEmail}
		_ = s.redisCache.SetCachedResendConfig(ctx, event.TeamID, resendCfg, 5*time.Minute)
	}

	recipient := strings.TrimSpace(event.AlertEmail)
	if recipient == "" {
		recipient = resendCfg.SenderEmail
	}
	if recipient == "" {
		s.logger.Error().Str("incident_id", event.IncidentID.String()).Msg("skipping alert: no recipient email")
		_ = s.persistAlert(event.IncidentID, "", "failed", time.Time{})
		return
	}

	status := "sent"
	sentAt := time.Now().UTC()

	resendID, err := s.sendAlertEmail(resendCfg, event, recipient)
	if err != nil {
		status = "failed"
		sentAt = time.Time{}
		s.logger.Error().Err(err).
			Str("incident_id", event.IncidentID.String()).
			Str("recipient", recipient).
			Msg("failed to send incident email")
	} else {
		s.logger.Info().
			Str("incident_id", event.IncidentID.String()).
			Str("recipient", recipient).
			Str("resend_email_id", resendID).
			Msg("incident email sent")
	}

	_ = s.persistAlert(event.IncidentID, recipient, status, sentAt)
}

func (s *AlertService) sendAlertEmail(cfg ResendEmailConfig, event AlertEvent, recipient string) (string, error) {
	client := resendpkg.NewResendClient(cfg.APIKey)

	subject := fmt.Sprintf("[SOFON][DOWN] Monitor %s is down", event.MonitorID.String())
	if event.Type == AlertTypeRecovered {
		subject = fmt.Sprintf("[SOFON][RECOVERED] Monitor %s is back up", event.MonitorID.String())
	}

	htmlBody, textBody, err := buildMonitorEmail(event)
	if err != nil {
		return "", err
	}

	sendCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return client.SendEmail(sendCtx, &resendpkg.SendEmailRequest{
		From:    cfg.SenderEmail,
		To:      []string{recipient},
		Subject: subject,
		Html:    htmlBody,
		Text:    textBody,
	})
}

func (s *AlertService) persistAlert(incidentID uuid.UUID, alertEmail string, status string, sentAt time.Time) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	const query = `
INSERT INTO alerts (incident_id, alert_email, status, sent_at)
VALUES ($1, $2, $3, $4)
`
	var nullableSentAt any
	if !sentAt.IsZero() {
		nullableSentAt = sentAt
	}

	_, err := s.db.Exec(ctx, query, incidentID, alertEmail, status, nullableSentAt)
	return err
}

func (s *AlertService) WorkerClosingWait() {
	s.workerWG.Wait()
}

func buildMonitorEmail(event AlertEvent) (string, string, error) {
	type templateData struct {
		IncidentID string
		MonitorID  string
		MonitorURL string
		Reason     string
		StatusCode int
		LatencyMs  int64
		CheckedAt  string
		StateTitle string
		BannerBg   string
		BannerFg   string
		Message    string
	}

	stateTitle := "Monitor Down"
	bannerBg := "#dc2626"
	bannerFg := "#ffffff"
	message := "We detected an outage for one of your monitors. Please review the details below and take action."

	if event.Type == AlertTypeRecovered {
		stateTitle = "Monitor Recovered"
		bannerBg = "#16a34a"
		message = "Good news. Your monitor is responding again and the incident has been marked as resolved."
	}

	data := templateData{
		IncidentID: event.IncidentID.String(),
		MonitorID:  event.MonitorID.String(),
		MonitorURL: event.MonitorURL,
		Reason:     event.Reason,
		StatusCode: event.StatusCode,
		LatencyMs:  event.LatencyMs,
		CheckedAt:  event.CheckedAt.UTC().Format(time.RFC1123Z),
		StateTitle: stateTitle,
		BannerBg:   bannerBg,
		BannerFg:   bannerFg,
		Message:    message,
	}

	const htmlTpl = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:{{ .BannerBg }};color:{{ .BannerFg }};padding:16px 24px;font-size:18px;font-weight:700;">
                Sofon Alert: {{ .StateTitle }}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px 24px;font-size:14px;line-height:1.6;">
                {{ .Message }}
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
                  <tr><td style="font-weight:700;width:170px;border-bottom:1px solid #e2e8f0;">Incident ID</td><td style="border-bottom:1px solid #e2e8f0;">{{ .IncidentID }}</td></tr>
                  <tr><td style="font-weight:700;border-bottom:1px solid #e2e8f0;">Monitor ID</td><td style="border-bottom:1px solid #e2e8f0;">{{ .MonitorID }}</td></tr>
                  <tr><td style="font-weight:700;border-bottom:1px solid #e2e8f0;">URL</td><td style="border-bottom:1px solid #e2e8f0;word-break:break-word;">{{ .MonitorURL }}</td></tr>
                  <tr><td style="font-weight:700;border-bottom:1px solid #e2e8f0;">Reason</td><td style="border-bottom:1px solid #e2e8f0;">{{ .Reason }}</td></tr>
                  <tr><td style="font-weight:700;border-bottom:1px solid #e2e8f0;">HTTP Status</td><td style="border-bottom:1px solid #e2e8f0;">{{ .StatusCode }}</td></tr>
                  <tr><td style="font-weight:700;border-bottom:1px solid #e2e8f0;">Latency</td><td style="border-bottom:1px solid #e2e8f0;">{{ .LatencyMs }} ms</td></tr>
                  <tr><td style="font-weight:700;">Checked At (UTC)</td><td>{{ .CheckedAt }}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 20px 24px;font-size:12px;color:#475569;background:#f8fafc;border-top:1px solid #e2e8f0;">
                You are receiving this email because this monitor is configured with your alert email in Sofon.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

	const textTpl = `Sofon Alert: {{ .StateTitle }}

Incident ID: {{ .IncidentID }}
Monitor ID: {{ .MonitorID }}
URL: {{ .MonitorURL }}
Reason: {{ .Reason }}
HTTP Status: {{ .StatusCode }}
Latency: {{ .LatencyMs }} ms
Checked At (UTC): {{ .CheckedAt }}
`

	htmlT, err := template.New("monitor_down_html").Parse(htmlTpl)
	if err != nil {
		return "", "", err
	}
	textT, err := template.New("monitor_down_text").Parse(textTpl)
	if err != nil {
		return "", "", err
	}

	var htmlBuf strings.Builder
	if err := htmlT.Execute(&htmlBuf, data); err != nil {
		return "", "", err
	}
	var textBuf strings.Builder
	if err := textT.Execute(&textBuf, data); err != nil {
		return "", "", err
	}

	return htmlBuf.String(), textBuf.String(), nil
}
