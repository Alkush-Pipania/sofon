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

type AlertService struct {
	// lifecycle
	workerCount int
	workerWG    sync.WaitGroup

	// config
	ownerEmail       string
	resendAPIKey     string
	resendKillSwitch bool

	// dependencies
	db           *pgxpool.Pool
	resendClient resendpkg.Client

	// channels
	alertChan chan AlertEvent

	// misc
	logger *zerolog.Logger
}

func NewAlertService(alertConfig *config.AlertConfig, db *pgxpool.Pool, alertChan chan AlertEvent, logger *zerolog.Logger) *AlertService {
	return &AlertService{
		workerCount:      alertConfig.WorkerCount,
		ownerEmail:       strings.TrimSpace(alertConfig.OwnerEmail),
		resendAPIKey:     strings.TrimSpace(alertConfig.ResendAPIKey),
		resendKillSwitch: alertConfig.ResendKillSwitch,
		db:               db,
		resendClient:     resendpkg.NewResendClient(strings.TrimSpace(alertConfig.ResendAPIKey)),
		alertChan:        alertChan,
		logger:           logger,
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

func (s *AlertService) processAlert(alert AlertEvent) {
	if alert.Type == "" {
		alert.Type = AlertTypeDown
	}

	recipient := strings.TrimSpace(alert.AlertEmail)
	if recipient == "" {
		recipient = s.ownerEmail
	}

	if recipient == "" {
		s.logger.Error().
			Str("incident_id", alert.IncidentID.String()).
			Str("monitor_id", alert.MonitorID.String()).
			Msg("skipping alert: recipient email is empty")
		if err := s.persistAlert(alert.IncidentID, "", "failed", time.Time{}); err != nil {
			s.logger.Error().
				Err(err).
				Str("incident_id", alert.IncidentID.String()).
				Str("monitor_id", alert.MonitorID.String()).
				Msg("failed to persist alert record for empty recipient")
		}
		return
	}

	if s.resendKillSwitch {
		s.logger.Warn().
			Str("incident_id", alert.IncidentID.String()).
			Str("monitor_id", alert.MonitorID.String()).
			Str("recipient", recipient).
			Msg("email sending skipped: resend kill switch is enabled")
		if err := s.persistAlert(alert.IncidentID, recipient, "skipped_kill_switch", time.Time{}); err != nil {
			s.logger.Error().
				Err(err).
				Str("incident_id", alert.IncidentID.String()).
				Str("monitor_id", alert.MonitorID.String()).
				Msg("failed to persist skipped alert record")
		}
		return
	}

	status := "sent"
	sentAt := time.Now().UTC()

	resendID, err := s.sendAlertEmail(alert, recipient)
	if err != nil {
		status = "failed"
		sentAt = time.Time{}
		s.logger.Error().
			Err(err).
			Str("incident_id", alert.IncidentID.String()).
			Str("monitor_id", alert.MonitorID.String()).
			Str("recipient", recipient).
			Msg("failed to send incident email")
	} else {
		s.logger.Info().
			Str("incident_id", alert.IncidentID.String()).
			Str("monitor_id", alert.MonitorID.String()).
			Str("recipient", recipient).
			Str("resend_email_id", resendID).
			Msg("incident email sent")
	}

	if err := s.persistAlert(alert.IncidentID, recipient, status, sentAt); err != nil {
		s.logger.Error().
			Err(err).
			Str("incident_id", alert.IncidentID.String()).
			Str("monitor_id", alert.MonitorID.String()).
			Msg("failed to persist alert record")
	}
}

func (s *AlertService) sendAlertEmail(alert AlertEvent, recipient string) (string, error) {
	if s.resendAPIKey == "" {
		return "", fmt.Errorf("missing resend api key")
	}
	if s.ownerEmail == "" {
		return "", fmt.Errorf("missing owner email for sender identity")
	}

	subject := fmt.Sprintf("[SOFON][DOWN] Monitor %s is down", alert.MonitorID.String())
	if alert.Type == AlertTypeRecovered {
		subject = fmt.Sprintf("[SOFON][RECOVERED] Monitor %s is back up", alert.MonitorID.String())
	}

	htmlBody, textBody, err := buildMonitorEmail(alert)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return s.resendClient.SendEmail(ctx, &resendpkg.SendEmailRequest{
		From:    s.ownerEmail,
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

// WorkerClosingWait waits for alert workers to complete
func (s *AlertService) WorkerClosingWait() {
	s.workerWG.Wait()
}

func buildMonitorEmail(alert AlertEvent) (string, string, error) {
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

	if alert.Type == AlertTypeRecovered {
		stateTitle = "Monitor Recovered"
		bannerBg = "#16a34a"
		bannerFg = "#ffffff"
		message = "Good news. Your monitor is responding again and the incident has been marked as resolved."
	}

	data := templateData{
		IncidentID: alert.IncidentID.String(),
		MonitorID:  alert.MonitorID.String(),
		MonitorURL: alert.MonitorURL,
		Reason:     alert.Reason,
		StatusCode: alert.StatusCode,
		LatencyMs:  alert.LatencyMs,
		CheckedAt:  alert.CheckedAt.UTC().Format(time.RFC1123Z),
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
