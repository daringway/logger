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

export type LoggingConfig = Partial<z.infer<typeof baseZodLogConfig>>;
