package result

import (
	"time"

	"github.com/alkush-pipania/sofon/internals/modules/alert"
	"github.com/alkush-pipania/sofon/internals/modules/executor"
	"github.com/google/uuid"
)

func (rp *ResultProcessor) successWorker() {
	defer rp.workerWG.Done()

	for r := range rp.successChan {
		rp.handleSuccess(r)
	}
}

func (rp *ResultProcessor) handleSuccess(r executor.HTTPResult) {
	ctx := rp.ctx

	defer func() {
		// ALWAYS re-schedule at last
		rp.monitorSvc.ScheduleMonitor(ctx, r.MonitorID, r.IntervalSec, "result.success_worker")
	}()

	// store success in redis
	if err := rp.redisSvc.StoreStatus(ctx, r.MonitorID, r.Status, r.LatencyMs, r.CheckedAt); err != nil {
		rp.logger.Error().
			Err(err).
			Str("monitor_id", r.MonitorID.String()).
			Msg("failed to store success status in redis")
	}
	rp.logger.Info().Str("monitor_id", r.MonitorID.String()).Msg("Success status stored in redis")

	// Fetch incident state from Redis
	incident, err := rp.redisSvc.GetIncident(ctx, r.MonitorID)
	if err != nil {
		// Redis unreliable → skip recovery logic
		rp.logger.Error().
			Err(err).
			Msg("failed to get incident from redis, skipping recovery")
		return
	}
	if incident == nil { // No incident → nothing to recover
		rp.logger.Info().Str("monitor_id", r.MonitorID.String()).Msg("No old incident found in redis")
		return
	}

	rp.logger.Info().Str("monitor_id", r.MonitorID.String()).Msg("old incident found in redis")

	// Close DB incident IF it was ever created
	dbIncident := incident["db_incident"] == "true"
	var closedIncidentID = uuid.Nil

	if dbIncident {
		incidentID, closed, err := rp.incidentRepo.CloseIncident(ctx, r.MonitorID, time.Now())
		if err != nil {
			rp.logger.Error().
				Err(err).
				Msg("failed to close incident in DB, keeping redis incident")
			return
		}
		if !closed {
			rp.logger.Warn().
				Str("monitor_id", r.MonitorID.String()).
				Msg("recovery detected but no open DB incident found")
		} else {
			closedIncidentID = incidentID
		}
	}

	if dbIncident && closedIncidentID != uuid.Nil {
		shouldSendRecovered, err := rp.redisSvc.MarkIncidentRecoveredAlertedIfNotSet(ctx, r.MonitorID)
		if err != nil {
			rp.logger.Error().
				Err(err).
				Str("monitor_id", r.MonitorID.String()).
				Msg("failed to mark recovered alert decision")
		} else if shouldSendRecovered {
			rp.alertChan <- alert.AlertEvent{
				IncidentID: closedIncidentID,
				Type:       alert.AlertTypeRecovered,
				MonitorID:  r.MonitorID,
				MonitorURL: r.MonitorURL,
				AlertEmail: r.AlertEmail,
				Reason:     "RECOVERED",
				StatusCode: r.Status,
				LatencyMs:  r.LatencyMs,
				CheckedAt:  r.CheckedAt,
			}
			rp.logger.Info().
				Str("monitor_id", r.MonitorID.String()).
				Str("incident_id", closedIncidentID.String()).
				Msg("recovery alert sent to alert channel")
		} else {
			rp.logger.Info().
				Str("monitor_id", r.MonitorID.String()).
				Str("incident_id", closedIncidentID.String()).
				Msg("recovery alert already sent for this incident")
		}
	}

	// Clear Redis incident (safe now)
	if err := rp.redisSvc.ClearIncident(ctx, r.MonitorID); err != nil {
		rp.logger.Error().
			Err(err).
			Msg("failed to clear incident from redis")
	}

	rp.logger.Info().Str("monitor_id", r.MonitorID.String()).Msg("Old incident is cleared from redis")

	// Clear retry state (if exists)
	if err := rp.redisSvc.ClearRetry(ctx, r.MonitorID); err != nil {
		rp.logger.Debug().
			Err(err).
			Msg("failed to clear retry state from redis")
	}
}
