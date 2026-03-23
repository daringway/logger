export type LoggingConfig = {
  logLevel?: 'metrics' | 'error' | 'warn' | 'info' | 'log' | 'debug' | 'trace';
  logSecondsBetweenMetrics?: number;
  logObjects?: boolean;
  logPretty?: boolean;
  logPriorityThresholdBytes?: number;
  logMeta?: Record<string, string> | null;
  silentInit?: boolean;
};

export type HonoOptions = {
  doNotLogURLs?: RegExp;
};

export type SolidStartOptions = {
  doNotLogURLs?: RegExp;
};

export function initLogger(configuration?: Partial<LoggingConfig>): void;
export function runInContext<R>(context: Record<string, unknown>, fn: () => R): R;
export function honoLoggerMiddleware(
  options?: HonoOptions,
): (ctx: unknown, next: () => Promise<void>) => Promise<void>;
export function solidStartLoggerMiddleware(
  options?: SolidStartOptions,
): {
  onRequest: (event: { request: Request; response: Response; url?: URL }) => void;
  onBeforeResponse: (event: { request: Request; response: Response; url?: URL }) => void;
};
