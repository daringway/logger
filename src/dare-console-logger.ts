// deno-lint-ignore-file no-explicit-any
// noinspection JSUnusedGlobalSymbols
import OptimizedQueue from "./optimized-queue.ts";
import process from "node:process";
import { MetricsTracker } from "./dare-metrics.ts";
import { asyncLocalStorage } from "./utils.ts";
import { baseZodLogConfig, type LoggingConfig } from "./zod.ts";

let initialized = false;

// Change with caution
const bufferFlushSizeBytes =
  // reducing by 128 for flush stat logger
  process.stdout.writableHighWaterMark || 4096; // General Buffer Size on Linux System

type LogLevelName =
  | "metrics"
  | "error"
  | "warn"
  | "info"
  | "log"
  | "debug"
  | "trace";

const logLevels: Record<LogLevelName, number> = {
  error: 0,
  metrics: 1,
  warn: 2,
  info: 3,
  log: 4,
  debug: 5,
  trace: 6,
};

interface LogObject {
  level: string; // Specific-required field
  [key: string]: any; // Index signature allowing any other fields with any value
}

// set defaults
const defaultValues = {
  logLevel:"log",
  logSecondsBetweenMetrics: 500,
  logPriorityThresholdBytes: 1024 * 1024, // 1 MB
  logMeta: null,
  logObjects: false,
  logPretty: false,
  logWithConsole: false,
}

export let logConfig = baseZodLogConfig.parse(defaultValues);
let logLevelValue = logLevels[logConfig.logLevel];

const origLog = console.log;
const origError = console.error;
const origInfo = console.info;
const origWarn = console.warn;
const origDebug = console.debug;

const logQueue = new OptimizedQueue();
let flushTimeout: number | undefined = undefined;
let isFlushing = false;

// let nextOutputMetricsTime = 0;
const metricNames = [
  "logWrittenCount",
  "logFlushCount",
  "logFlushBytes",
  "logFlushMS",
  "logStdoutBackpressureCount",
  "logStdoutDrainMS",
];
const logInternalMetrics = new MetricsTracker(metricNames, {
  metricFor: "logger",
  elapseTimeEnabled: true,
  writeIntervalS: logConfig.logSecondsBetweenMetrics,
});

interface DequeBatchResult {
  logCount: number;
  totalSize: number;
  output: string;
}

function dequeBatch(): DequeBatchResult {
  const logs: string[] = [];
  let totalSize = 0;

  while (totalSize < bufferFlushSizeBytes) {
    const logObject = logQueue.dequeue();
    if (!logObject) {
      // No more logs in the queue
      break;
    }

    // Ensure the total size does not exceed bufferFlushSizeBytes, but always log at least one entry
    if (totalSize + logObject.size > bufferFlushSizeBytes && logs.length > 0) {
      logQueue.requeue(logObject); // Put the log back in the queue if the size exceeds the limit
      break;
    }

    logs.push(logObject.item);
    totalSize += logObject.size;
  }

  const output = logs.join(""); // Concatenate all log strings into one

  // Return an object (dictionary) with logCount, totalSize, and output
  return {
    logCount: logs.length,
    totalSize,
    output,
  };
}

/**
 * Run a function in a specific context
 * @param context object
 * @param fn
 */
export function runInContext<R>(context: Record<string, any>, fn: () => R): R {
  return asyncLocalStorage.run(context, fn);
}

export function flushLogQueue(emptyTheQueue: boolean = false) {
  clearTimeout(flushTimeout);
  flushTimeout = undefined;
  if (logQueue.isEmpty()) {
    isFlushing = false;
    // stop buffer flushing with no logs, so programs can exit and not hang.
    return;
  }
  isFlushing = true;
  const logFlushTimer = logInternalMetrics.startTimer("logFlushMS");

  const { logCount, totalSize, output } = dequeBatch();
  logInternalMetrics.increment("logWrittenCount", logCount);
  logInternalMetrics.increment("logFlushBytes", totalSize);
  logInternalMetrics.increment("logFlushCount");

  if (!process.stdout.write(output)) {
    // Handle backpressure
    const drainTimer = logInternalMetrics.startTimer("logStdoutDrainMS");

    process.stdout.once("drain", () => {
      logFlushTimer.stop();
      drainTimer.stop();
      logInternalMetrics.increment("logStdoutBackpressureCount");
      flushLogQueue(emptyTheQueue);
    });
  } else {
    logFlushTimer.stop();
    if (
      emptyTheQueue ||
      logQueue.byteSize() > logConfig.logPriorityThresholdBytes
    ) {
      // Not enough logs, give a moment for more
      flushLogQueue(emptyTheQueue);
    } else {
      flushTimeout = setTimeout(flushLogQueue, 0);
    }
  }
}

const logFormatter = (
  level: LogLevelName,
  ...logMessages: any[]
): LogObject => {
  let message: string | undefined = undefined;

  const context: Record<string, any> = {
    ...(logConfig.logMeta !== null &&
      Object.keys(logConfig.logMeta).length > 0 && { meta: logConfig.logMeta }),
    ...asyncLocalStorage.getStore(),
  };
  const metrics: object = context?.metrics?.getMetrics() || {};
  delete context["metrics"];

  // If logs are in callback
  const args = typeof logMessages[0] === "function"
    ? logMessages[0]()
    : logMessages;

  // function logs could return a non-array
  const argArray = Array.isArray(args) ? args : [args];
  let log: Record<string, any> = {};
  let error;

  argArray.forEach((part, index) => {
    if (part instanceof Error) {
      error = {
        message: part.message || part.name,
        data: JSON.parse(JSON.stringify(part)),
        stack: part.stack ? part.stack.split("\n") : [],
      };
    } else if (typeof part === "string") {
      if (message) {
        message += ' ' + part;
      } else {
        message = part;
      }
    } else if (
      part !== null &&
      typeof part === "object" &&
      !Array.isArray(part)
    ) {
      if (part.meta) {
        if (context.meta) {
          Object.assign(context.meta, part.meta);
        } else {
          context.meta = part.meta;
        }
      } else if (part.metrics) {
        Object.assign(metrics, part.metrics);
      } else {
        log = { ...log, ...part };
      }
    } else {
      log[`message.${index}`] = part;
    }
  });

  return {
    timestamp: new Date().toISOString(),
    message: message || "unknown log event",
    level: level,
    ...(Object.keys(log).length > 0 && { log: log }), // Only add data if it has content
    ...(error !== undefined && { error: error }), // Only add data if it has content
    ...(Object.keys(context).length > 0 && { context: context }), // Only add data if it has content
    ...(Object.keys(metrics).length > 0 && { metrics: metrics }), // Only add data if it has content
    log_id: crypto.randomUUID(),
  };
};

function queueLog(logObject: LogObject) {
  if (logConfig.logPretty ) {
    origLog(JSON.stringify(logObject, undefined, 2));
  } else if (logConfig.logWithConsole) {
    origLog(JSON.stringify(logObject));
  } else {
    logQueue.enqueue(JSON.stringify(logObject) + "\n");
    if (!isFlushing && !flushTimeout) {
      flushTimeout = setTimeout(flushLogQueue, 0);
    }
  }
}

/**
 * Log a metrics object
 * @param metricsFor name of the metrics
 * @param metrics object
 */
export function consoleMetrics(
  metricsFor: string,
  metrics: Record<string, number>,
): void {
  const output = logFormatter("metrics", `metrics for ${metricsFor}`, {
    metrics: metrics,
  });
  if (logConfig.logObjects) {
    origWarn(output);
  } else {
    queueLog(output);
  }
}

/**
 * Initialize the logger
 * @param configuration
 */
export function initLogger(
  configuration: Partial<LoggingConfig> = {},
): void {
  const updates = baseZodLogConfig.partial().parse(configuration);
  const newConfig = {
    logLevel: process.env.LOG_LEVEL ?? updates.logLevel ?? logConfig.logLevel,
    logSecondsBetweenMetrics: Number(process.env.LOG_SECONDS_BETWEEN_METRICS) ?? updates.logSecondsBetweenMetrics ?? logConfig.logSecondsBetweenMetrics,
    logPriorityThresholdBytes: Number(process.env.LOG_PRIORITY_THRESHOLD_BYTES) ?? updates.logPriorityThresholdBytes ?? logConfig.logPriorityThresholdBytes,
    logMeta: {...logConfig.logMeta, ...updates.logMeta},
    logObjects: process.env.LOG_OBJECTS ?? updates.logObjects ?? logConfig.logObjects,
    logPretty: process.env.LOG_PRETTY ?? updates.logPretty ?? logConfig.logPretty,
    logWithConsole: process.env.LOG_WITH_CONSOLE ?? updates.logWithConsole ?? logConfig.logWithConsole,
  };

  logConfig = baseZodLogConfig.partial().parse(newConfig);
  Object.assign(logConfig, newConfig);
  logLevelValue = logLevels[logConfig.logLevel];

  if (logConfig.logMeta && Object.keys(logConfig.logMeta).length === 0) {
    logConfig.logMeta = null;
  }
  if (logConfig.logObjects && logConfig.logSecondsBetweenMetrics > 0) {
    console.info(
      "logObjects enabled, setting secondsBetweenMetrics=0",
    );
    logConfig.logSecondsBetweenMetrics = 0;
  }
  if (logConfig.logSecondsBetweenMetrics > 0) {
    logInternalMetrics.startAutoWrite(updates.logSecondsBetweenMetrics);
  } else {
    logInternalMetrics.stopAutoWrite();
  }

  logConfig = baseZodLogConfig.parse(logConfig);

  if (!initialized) {
    console.error = (...args: any[]): void => {
      // errors get priority
      // Always log and immediately add to the queue
      const output = logFormatter("error", ...args);
      if (logConfig.logObjects) {
        origError(output);
      } else {
        queueLog(output);
      }
    };

    console.warn = (...args: any[]): void => {
      if (logLevelValue >= logLevels.warn) {
        const output = logFormatter("warn", ...args);
        if (logConfig.logObjects) {
          origWarn(output);
        } else {
          queueLog(output);
        }
      }
    };

    console.info = (...args: any[]): void => {
      if (logLevelValue >= logLevels.info) {
        const output = logFormatter("info", ...args);
        if (logConfig.logObjects) {
          origInfo(output);
        } else {
          queueLog(output);
        }
      }
    };

    console.log = (...args: any[]): void => {
      if (logLevelValue >= logLevels.log) {
        const output = logFormatter("log", ...args);
        if (logConfig.logObjects) {
          origLog(output);
        } else {
          queueLog(output);
        }
      }
    };

    console.debug = (...args: any[]): void => {
      if (logLevelValue >= logLevels.debug) {
        const output = logFormatter("debug", ...args);
        if (logConfig.logObjects) {
          origDebug(output);
        } else {
          queueLog(output);
        }
      }
    };

    console.trace = (...args: any[]): void => {
      if (logLevelValue >= logLevels.trace) {
        const output = logFormatter("trace", ...args);

        if (logConfig.logObjects) {
          origDebug(output);
        } else {
          queueLog(output);
        }
      }
    };
  }

  if (!logConfig.silentInit) {
    if (initialized) {
      console.debug(
        "DaringWay logger configuration updated",
        { updates: updates },
        { logConfiguration: logConfig },
      );
    } else {
      initialized = true;
      console.debug(
        "DaringWay logger configuration initialized",
        { logConfiguration: logConfig },
      );
    }
  }

  if (logConfig.logObjects) {
    console.warn(
      "Only set 'LOG_OBJECTS=true' when running in local development",
    );
  }
}
