package main

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// ============================================================================
// Deeply Nested Goroutine & Channel Debugging Example
//
// This simulates a multi-stage data processing pipeline:
//   Ingest -> Validate -> Transform -> Enrich -> Aggregate
//
// Each stage is its own set of goroutines communicating via channels.
// The supervisor monitors all stages for errors and coordinates shutdown.
//
// DEBUGGER TIPS:
// - Set breakpoints in validatorWorker, stepA/stepB/stepC, enrichAndMerge,
//   computeFinalScore, and the supervisor goroutine.
// - Use "Show All Goroutines" to see the goroutine tree.
// - Trace a Job struct through the pipeline with conditional breakpoints.
// - Watch channel buffer states.
// ============================================================================

// Job represents a unit of work flowing through the pipeline.
type Job struct {
	ID      int
	Payload string
}

// Result holds the final output after all processing stages.
type Result struct {
	JobID       int
	Original    string
	Validated   bool
	Transformed string
	Enriched    string
	FinalScore  float64
}

// StageMetrics tracks what happens inside each pipeline stage.
type StageMetrics struct {
	mu         sync.Mutex
	Received   int
	Processed  int
	Dropped    int
	Errors     int
	LatencySum time.Duration
}

func (sm *StageMetrics) record(latency time.Duration) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.Processed++
	sm.LatencySum += latency
}

func (sm *StageMetrics) recordError() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.Errors++
}

// ============================================================================
// STAGE 1: Ingestion — generates raw jobs and fans them into the pipeline.
// ============================================================================
func ingestionStage(ctx context.Context, numJobs int, bufferSize int) <-chan Job {
	out := make(chan Job, bufferSize)

	go func() {
		defer close(out)
		for i := 0; i < numJobs; i++ {
			select {
			case <-ctx.Done():
				return
			case out <- Job{
				ID:      i + 1,
				Payload: fmt.Sprintf("raw-data-%d", i+1),
			}:
			}
			time.Sleep(time.Duration(rand.Intn(5)) * time.Millisecond)
		}
	}()
	return out
}

// ============================================================================
// STAGE 2: Validation — spawns a pool of validators.
// Each validator reads from the input channel, validates, and writes to output.
// ============================================================================
func validationStage(ctx context.Context, in <-chan Job, numWorkers int) (
	validChan <-chan Job, rejectedChan <-chan Job,
) {
	valid := make(chan Job, 10)
	rejected := make(chan Job, 5)
	var wg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			validatorWorker(ctx, workerID, in, valid, rejected)
		}(i + 1)
	}

	go func() {
		wg.Wait()
		close(valid)
		close(rejected)
	}()

	return valid, rejected
}

func validatorWorker(ctx context.Context, id int, in <-chan Job, valid, rejected chan<- Job) {
	// Nested helper inside the goroutine — demonstrates multi-level call stacks.
	isValid := func(j Job) bool {
		if j.ID%7 == 0 {
			return j.ID%2 == 0
		}
		if j.ID%13 == 0 {
			time.Sleep(50 * time.Millisecond)
			return false
		}
		return len(j.Payload) > 0
	}

	for {
		select {
		case <-ctx.Done():
			return
		case j, ok := <-in:
			if !ok {
				return
			}
			if isValid(j) {
				select {
				case valid <- j:
				case <-ctx.Done():
					return
				}
			} else {
				select {
				case rejected <- j:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

// ============================================================================
// STAGE 3: Transformation — deeply nested processing goroutines.
// Each job passes through a chain of transform steps.
// ============================================================================
func transformationStage(ctx context.Context, in <-chan Job, numWorkers int) <-chan Job {
	out := make(chan Job, 10)
	var wg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			transformationWorker(ctx, workerID, in, out)
		}(i + 1)
	}

	go func() {
		wg.Wait()
		close(out)
	}()

	return out
}

func transformationWorker(ctx context.Context, id int, in <-chan Job, out chan<- Job) {
	for {
		select {
		case <-ctx.Done():
			return
		case j, ok := <-in:
			if !ok {
				return
			}
			// Apply a chain of nested transformations.
			transformed := j
			transformed.Payload = stepA(stepB(stepC(j.Payload, id), id), id)
			select {
			case out <- transformed:
			case <-ctx.Done():
				return
			}
		}
	}
}

// stepA, stepB, stepC form a deep call chain within a goroutine.
func stepA(s string, wid int) string {
	time.Sleep(time.Duration(rand.Intn(3)+1) * time.Millisecond)
	return fmt.Sprintf("A(%s|w%d)", s, wid)
}

func stepB(s string, wid int) string {
	inner := func(x string) string {
		return fmt.Sprintf("innerB(%s)", x)
	}
	time.Sleep(time.Duration(rand.Intn(3)+1) * time.Millisecond)
	return fmt.Sprintf("B(%s)", inner(s))
}

func stepC(s string, wid int) string {
	var prefix func(int) string
	prefix = func(lvl int) string {
		if lvl > 0 {
			return prefix(lvl-1) + ">"
		}
		return ""
	}
	time.Sleep(time.Duration(rand.Intn(3)+1) * time.Millisecond)
	return fmt.Sprintf("C(%s)%s", s, prefix(wid%4))
}

// ============================================================================
// STAGE 4: Enrichment — each job forks sub-goroutines that fetch enrichment
// data concurrently and merge results back.
// ============================================================================
func enrichmentStage(ctx context.Context, in <-chan Job) <-chan Job {
	out := make(chan Job, 10)
	go func() {
		defer close(out)
		for {
			select {
			case <-ctx.Done():
				return
			case j, ok := <-in:
				if !ok {
					return
				}
				enrichAndMerge(ctx, j, out)
			}
		}
	}()
	return out
}

func enrichAndMerge(ctx context.Context, j Job, out chan<- Job) {
	type enrichment struct {
		key   string
		value string
	}

	chA := make(chan enrichment, 1)
	chB := make(chan enrichment, 1)
	chC := make(chan enrichment, 1)

	go func() {
		select {
		case <-ctx.Done():
		case chA <- enrichment{"sourceA", fmt.Sprintf("enriched-A-%d", j.ID)}:
		}
	}()
	go func() {
		select {
		case <-ctx.Done():
		case chB <- enrichment{"sourceB", fmt.Sprintf("enriched-B-%d", j.ID)}:
		}
	}()
	go func() {
		select {
		case <-ctx.Done():
		case chC <- enrichment{"sourceC", fmt.Sprintf("enriched-C-%d", j.ID)}:
		}
	}()

	merged := make(map[string]string)
	var mergeWg sync.WaitGroup
	mergeWg.Add(1)
	go func() {
		defer mergeWg.Done()
		for i := 0; i < 3; i++ {
			select {
			case <-ctx.Done():
				return
			case e := <-chA:
				merged[e.key] = e.value
			case e := <-chB:
				merged[e.key] = e.value
			case e := <-chC:
				merged[e.key] = e.value
			}
		}
	}()
	mergeWg.Wait()

	for k, v := range merged {
		j.Payload = fmt.Sprintf("%s|%s=%s", j.Payload, k, v)
	}

	select {
	case <-ctx.Done():
	case out <- j:
	}
}

// ============================================================================
// STAGE 5: Aggregation — collects all final results and computes scores.
// ============================================================================
func aggregationStage(ctx context.Context, in <-chan Job, metrics *StageMetrics) <-chan Result {
	out := make(chan Result, 10)
	go func() {
		defer close(out)
		for {
			select {
			case <-ctx.Done():
				return
			case j, ok := <-in:
				if !ok {
					return
				}
				start := time.Now()
				score := computeFinalScore(j, 5)
				res := Result{
					JobID:       j.ID,
					Original:    j.Payload,
					Validated:   true,
					Transformed: j.Payload,
					Enriched:    j.Payload,
					FinalScore:  score,
				}
				metrics.record(time.Since(start))
				select {
				case out <- res:
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out
}

func computeFinalScore(j Job, depth int) float64 {
	if depth <= 0 {
		base := float64(j.ID) * 1.5
		return base + float64(len(j.Payload))*0.1
	}
	subScore := computeFinalScore(j, depth-1)
	return subScore*0.9 + float64(depth)*0.1
}

// ============================================================================
// SUPERVISOR — goroutine that monitors all stages via heartbeat / error
// channels and can initiate emergency shutdown.
// ============================================================================
type supervisor struct {
	heartbeatCh chan string
	errorCh     chan error
	cancel      context.CancelFunc
}

func startSupervisor(ctx context.Context, cancel context.CancelFunc) *supervisor {
	sv := &supervisor{
		heartbeatCh: make(chan string, 20),
		errorCh:     make(chan error, 50),
		cancel:      cancel,
	}

	go func() {
		ticker := time.NewTicker(15 * time.Millisecond)
		defer ticker.Stop()

		var monitorWg sync.WaitGroup
		monitorWg.Add(1)
		go func() {
			defer monitorWg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case err, ok := <-sv.errorCh:
					if !ok {
						return
					}
					fmt.Printf("  [supervisor] error: %v — shutting down\n", err)
					sv.cancel()
					return
				}
			}
		}()

		for {
			select {
			case <-ctx.Done():
				monitorWg.Wait()
				return
			case <-ticker.C:
				select {
				case sv.heartbeatCh <- fmt.Sprintf("hb@%s", time.Now().Format("15:04:05.000")):
				default:
				}
			}
		}
	}()

	return sv
}

// ============================================================================
// MAIN — wires up the full pipeline and runs it.
// ============================================================================
func main() {
	rand.New(rand.NewSource(time.Now().UnixNano()))

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	aggMetrics := &StageMetrics{}

	sv := startSupervisor(ctx, cancel)

	rawJobs := ingestionStage(ctx, 50, 5)
	validJobs, rejectedJobs := validationStage(ctx, rawJobs, 4)
	transformedJobs := transformationStage(ctx, validJobs, 3)
	enrichedJobs := enrichmentStage(ctx, transformedJobs)
	results := aggregationStage(ctx, enrichedJobs, aggMetrics)

	go func() {
		for rj := range rejectedJobs {
			fmt.Printf("  [reject] job #%d payload=%q\n", rj.ID, rj.Payload)
		}
	}()

	go func() {
		for hb := range sv.heartbeatCh {
			_ = hb
		}
	}()

	go func() {
		time.Sleep(100 * time.Millisecond)
		select {
		case <-ctx.Done():
			return
		case sv.errorCh <- fmt.Errorf("transient failure at %v", time.Now().Format("15:04:05.000")):
		default:
		}
	}()

	var finalResults []Result
	var resultsWg sync.WaitGroup
	resultsWg.Add(1)
	go func() {
		defer resultsWg.Done()
		for r := range results {
			finalResults = append(finalResults, r)
		}
	}()

	<-ctx.Done()
	fmt.Println("\n=== Pipeline shutting down ===")

	resultsWg.Wait()

	fmt.Printf("\n=== Results ===\n")
	fmt.Printf("Jobs completed: %d\n", len(finalResults))
	if len(finalResults) > 0 {
		fmt.Printf("First:  job #%d score=%.2f\n", finalResults[0].JobID, finalResults[0].FinalScore)
		fmt.Printf("Last:   job #%d score=%.2f\n", finalResults[len(finalResults)-1].JobID, finalResults[len(finalResults)-1].FinalScore)
	}
	fmt.Printf("Aggregate processed: %d\n", aggMetrics.Processed)

	fmt.Println("\n=== Debugger Tips ===")
	fmt.Println("1. Breakpoints in validatorWorker, stepA/B/C, enrichAndMerge")
	fmt.Println("2. Inspect goroutine call stacks at each nesting level")
	fmt.Println("3. Watch channel buffer states")
	fmt.Println("4. Conditional breakpoints to trace a single Job ID")
	fmt.Println("5. Examine supervisor + sub-goroutines")
	fmt.Println("6. Recursive computeFinalScore call stack")
	fmt.Print("\n")
}
