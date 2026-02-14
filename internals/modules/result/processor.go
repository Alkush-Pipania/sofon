package result

import (
	"context"
	"sync"

	"github.com/alkush-pipania/sofon/config"
	"github.com/alkush-pipania/sofon/internals/modules/alert"
	"github.com/alkush-pipania/sofon/internals/modules/executor"
	"github.com/alkush-pipania/sofon/internals/modules/monitor"
	"github.com/alkush-pipania/sofon/pkg/redis"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type MonitorService interface {
	LoadMonitor(context.Context, uuid.UUID) (monitor.Monitor, error)
	ScheduleMonitor(context.Context, uuid.UUID, int32, string)
}

type ResultProcessor struct {
	// lifecycle
	ctx      context.Context
	workerWG sync.WaitGroup

	// processor config
	successWorkerCount int
	failureWorkerCount int

	// services
	redisSvc     *redis.Client
	monitorSvc   MonitorService
	incidentRepo *MonitorIncidentRepository // here should be MonitorIncidentService, make a seperate module for Monitor Incident

	// channels
	resultChan  chan executor.HTTPResult
	successChan chan executor.HTTPResult
	failureChan chan executor.HTTPResult
	alertChan   chan alert.AlertEvent

	// misc
	logger *zerolog.Logger
}

func NewResultProcessor(
	ctx context.Context,
	resProcessorConfig *config.ResultProcessorConfig,
	redisSvc *redis.Client,
	resultChan chan executor.HTTPResult,
	incidentRepo *MonitorIncidentRepository,
	monitorSvc MonitorService,
	alertChan chan alert.AlertEvent,
	logger *zerolog.Logger,
) *ResultProcessor {
	return &ResultProcessor{
		ctx:                ctx,
		redisSvc:           redisSvc,
		resultChan:         resultChan,
		incidentRepo:       incidentRepo,
		monitorSvc:         monitorSvc,
		alertChan:          alertChan,
		successChan:        make(chan executor.HTTPResult, resProcessorConfig.SuccessChannelSize), // number should be passed as parameter
		failureChan:        make(chan executor.HTTPResult, resProcessorConfig.FailureChannelSize), // number should be passed as parameter
		successWorkerCount: resProcessorConfig.SuccessWorkerCount,
		failureWorkerCount: resProcessorConfig.FailureWorkerCount,
		logger:             logger,
	}
}

// StartResultProcessor starts the Result Processor
func (rp *ResultProcessor) StartResultProcessor() {
	// first
	// start success and failure workers
	rp.workerWG.Add(rp.successWorkerCount + rp.failureWorkerCount) // add for all as we have to wait for each worker to complete

	for range rp.successWorkerCount { // specify in config
		go rp.successWorker()
	}

	for range rp.failureWorkerCount { // specify in config
		go rp.failureWorker()
	}

	// now start result router
	go rp.router()

	rp.logger.Info().Msg("Result Processor Started with workers")
}

func (rp *ResultProcessor) router() {
	for r := range rp.resultChan {
		if r.Success {
			rp.successChan <- r
		} else {
			rp.failureChan <- r
		}
	}

	// closing success and failure channel
	close(rp.failureChan)
	close(rp.successChan)
}

// WorkersClosingWait waits for all workers to complete
func (rp *ResultProcessor) WorkersClosingWait() {
	rp.workerWG.Wait()
}

func (rp *ResultProcessor) cleanupRedis(ctx context.Context, monitorID uuid.UUID) {
	_ = rp.redisSvc.ClearIncident(ctx, monitorID)
	// rp.redisSvc.ClearRetry(ctx, monitorID)
}
