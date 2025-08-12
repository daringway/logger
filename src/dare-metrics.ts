// noinspection JSUnusedGlobalSymbols

import { consoleMetrics } from "./dare-console-logger.ts";

type DareMetrics<T extends string> = Record<T, number>;

interface MetricsConfig {
  metricFor: string;
  writeIntervalS: number;
  elapseTimeEnabled: boolean;
}

// export function logMetrics(metricsFor: string, metrics: object): void {
//   console.log(`metrics for ${metricsFor}`, {
//     metrics: metrics,
//   });
// }

class MetricTimer {
  private startTime: number;
  private tracker: MetricsTracker<string>;
  private readonly key: string;

  constructor(tracker: MetricsTracker<string>, key: string) {
    this.startTime = performance.now();
    this.tracker = tracker;
    this.key = key;
  }

  // Get the elapsed time in milliseconds
  stop() {
    const elapse = performance.now() - this.startTime;
    this.tracker.increment(this.key, elapse);
    this.startTime = performance.now();
  }
}

/**
 * A class to track metrics for a specific operation
 * @param metricNames - An array of metric names to track
 * @param config - Configuration options for the metrics tracker
 * @param config.metricFor - The name of the operation being tracked
 * @param config.writeIntervalS - The interval in seconds at which to write metrics to the console, default 180s, set to 0 to disable
 * @param config.elapseTimeEnabled - Whether to enable the elapse time metric, default rue
 * @returns A MetricsTracker instance
 * @example
 * const metricsTracker = new MetricsTracker(["metric1", "metric2"], {})
 */
export class MetricsTracker<T extends string> {
  #metrics: DareMetrics<T>;
  #intervalId: ReturnType<typeof setInterval> | null = null;
  #config: MetricsConfig = {
    metricFor: "unknown",
    writeIntervalS: 180, // default is every minute 3
    elapseTimeEnabled: true,
  };
  private elapseTimeTimer: MetricTimer | null = null;

  constructor(metricNames: T[], config: Partial<MetricsConfig> = {}) {
    this.#config = {
      ...this.#config,
      ...config,
    };

    // Initialize the metrics object with all metric names set to 0
    this.#metrics = metricNames.reduce((acc, metric) => {
      acc[metric] = 0;
      return acc;
    }, {} as DareMetrics<T>);

    if (this.#config.elapseTimeEnabled) {
      this.elapseTimeTimer = new MetricTimer(this, "elapseTimeMs");
      // @ts-ignore  an internal metric
      this.#metrics["elapseTimeMs"] = 0;
    }
    if (
      this.#config.writeIntervalS > 0 && this.#config.metricFor !== "unknown"
    ) {
      this.startAutoWrite(this.#config.writeIntervalS);
    }
  }

  // Method to start a timer
  startTimer(metric: T): MetricTimer {
    return new MetricTimer(this, metric);
  }

  // Method to increase a count
  increment(metric: T, amount = 1): void {
    this.#metrics[metric] += amount;
  }

  // Method to reset the metrics to zero
  resetMetrics(): void {
    for (const key in this.#metrics) {
      this.#metrics[key as T] = 0;
    }
  }

  // Method to write metrics to the console
  log(): void {
    if (this.#config.elapseTimeEnabled && this.elapseTimeTimer) {
      this.elapseTimeTimer.stop();
    }
    consoleMetrics(this.#config.metricFor, this.#metrics);
    this.resetMetrics();
    if (this.#config.elapseTimeEnabled) {
      this.elapseTimeTimer = new MetricTimer(this, "elapseTimeMs");
    }
  }

  // Start writing metrics to the console at intervals
  startAutoWrite(newIntervalS: number | undefined = undefined): void {
    if (newIntervalS !== undefined) {
      this.stopAutoWrite();
      this.#config.writeIntervalS = newIntervalS;
    }
    if (!this.#intervalId && this.#config.writeIntervalS > 0) {
      this.#intervalId = setInterval(
        () => this.log(),
        this.#config.writeIntervalS * 1000,
      );

      // Allow the process to exit if nothing else is pending
      if (
        typeof Deno !== "undefined" &&
        typeof Deno.unrefTimer === "function"
      ) {
        // Deno: interval id is a number
        Deno.unrefTimer(this.#intervalId as number);
      } else if (
        this.#intervalId &&
        typeof (this.#intervalId as any).unref === "function"
      ) {
        // Node: Timeout object has .unref()
        (this.#intervalId as any).unref();
      }
    }
  }

  // Stop auto-writing metrics
  stopAutoWrite(): void {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  // Get the current metrics
  getMetrics(resetMetrics = false): DareMetrics<T> {
    if (this.#config.elapseTimeEnabled && this.elapseTimeTimer) {
      this.elapseTimeTimer.stop();
    }
    const response = { ...this.#metrics };
    if (resetMetrics) {
      this.resetMetrics();
    }
    return response;
  }

  toString(): string {
    return JSON.stringify(this.getMetrics());
  }
}
