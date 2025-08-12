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
 */
export type LoggingConfig = {
  logLevel?: "metrics" | "error" | "warn" | "info" | "log" | "debug" | "trace";
  logSecondsBetweenMetrics?: number;
  logObjects?: boolean;
  logPretty?: boolean;
  logPriorityThresholdBytes?: number;
  logMeta?: Record<string, string> | null;
  silentInit?: boolean;
};
