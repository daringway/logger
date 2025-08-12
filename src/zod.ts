import * as z from "zod/v4";

const flexibleBoolean = z.preprocess((val) => {
  if (val === true || val === "true" || val === "yes") return true;
  if (val === false || val === "false" || val === "no") return false;
  throw new Error("Invalid boolean value: " + String(val));
}, z.boolean()).default(false);

export const baseZodLogConfig = z.object({
  logLevel: z.enum([
    "metrics",
    "error",
    "warn",
    "info",
    "log",
    "debug",
    "trace",
  ]),
  logSecondsBetweenMetrics: z.coerce.number().min(0),
  logObjects: flexibleBoolean,
  logPretty: flexibleBoolean,
  logPriorityThresholdBytes: z.number().min(10),
  logMeta: z.record(z.string(), z.string()).nullable(),
  silentInit: flexibleBoolean,
});

/**
 * Configuration options for the logger
 * @param logLevel - The level of logging to enable, default "log"
 * @param logSecondsBetweenMetrics - The number of seconds between logging metrics, default 500
 * @param logObjects - Whether to log objects, default false
 * @param logPretty - Whether to log in pretty format, default false
 * @param logPriorityThresholdBytes - The minimum size of the log to cache before forcing log to write, default 1 MB
 * @param logMeta - Additional metadata to log, default null
 * @param silentInit - Whether to suppress initialization messages, default false
 * @example
 * const logConfig = {
 *   logLevel: "info",
 }
 */
export type LoggingConfig = Partial<z.infer<typeof baseZodLogConfig>>;
