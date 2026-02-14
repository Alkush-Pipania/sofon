package scheduler

import (
	"context"
	"time"

	"github.com/alkush-pipania/sofon/config"
	rdb "github.com/alkush-pipania/sofon/pkg/redis"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

type Scheduler struct {
	ctx       context.Context
	interval  time.Duration
	ticker    *time.Ticker
	batchSize int

	jobChan chan JobPayload

	redisSvc *rdb.Client

	logger *zerolog.Logger
}

func NewScheduler(
	ctx context.Context,
	schedulerConfig *config.SchedulerConfig,
	jobchan chan JobPayload,
	redisSvc *rdb.Client,
	logger *zerolog.Logger,
) *Scheduler {
	return &Scheduler{
		ctx:       ctx,
		jobChan:   jobchan,
		redisSvc:  redisSvc,
		logger:    logger,
		interval:  schedulerConfig.Interval,
		batchSize: schedulerConfig.BatchSize,
	}
}

func (sc *Scheduler) StartScheduler() {
	sc.logger.Info().Msg("Scheduler started")
	ticker := time.NewTicker(sc.interval)
	sc.ticker = ticker

	go func() {
		for {
			select {
			case <-sc.ctx.Done():
				sc.ticker.Stop()
				sc.logger.Info().Msg("Scheduler stopped")
				return
			case <-ticker.C:
				sc.logger.Info().Msg("Scheduler Ticked")
				sc.doWork()
			}
		}
	}()
}

func (sc *Scheduler) doWork() {
	now := time.Now().Unix()

	items, err := sc.redisSvc.PopDue(sc.ctx, sc.batchSize)
	if err != nil {
		sc.logger.Error().Err(err).Msg("error to pop scheduled monitors from redis")
		return
	}
	if len(items) == 0 {
		return
	}

	sc.logger.Info().Msgf("Scheduler popped %v items", len(items))

	reinsert := make([]redis.Z, 0, 10)

	for i, item := range items {
		score := int64(item.Score)

		if score > now {
			reinsert = append(reinsert, redis.Z{
				Score:  item.Score,
				Member: item.Member.(string),
			})

			for _, future := range items[i+1:] {
				reinsert = append(reinsert, redis.Z{
					Score:  future.Score,
					Member: future.Member.(string),
				})
			}
			if err := sc.redisSvc.ScheduleBatch(sc.ctx, reinsert); err != nil {
				// log it
				sc.logger.Error().Err(err).Msg("error to schedule in batch")
			}
			sc.logger.Info().Msgf("Scheduler reinserted %v items", len(reinsert))
			break

		}

		id, err := uuid.Parse(item.Member.(string))
		if err != nil {
			sc.logger.Error().Err(err).Msg("error in parsing the schedule monitor Id to uuid")
			continue
		}

		select {
		case sc.jobChan <- JobPayload{MonitorID: id}:
		case <-sc.ctx.Done():
			return
		default:
			//	reinsert
			sc.logger.Info().Msg("Applying backpressure and re-scheduling")
			backoff := time.Unix(score, 0).Add(2 * time.Second)
			if err := sc.redisSvc.Schedule(sc.ctx, item.Member.(string), backoff); err != nil {
				sc.logger.Error().Err(err).Msg("error in scheduling monitor")
				// enqueue in queue
			}

		}

	}

}
