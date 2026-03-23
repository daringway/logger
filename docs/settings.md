# Settings Reference

This document is the detailed companion for [`agents.md`](../agents.md).

## Configuration Precedence

For logger config (`initLogger`), values are resolved in this order:

1. Environment variable (if available for that setting)
2. `initLogger({...})` argument
3. Existing in-memory `logConfig`
4. Built-in defaults

## Logger Settings (`initLogger`)

### logLevel

- Scope: logger
- Type: `"metrics" | "error" | "warn" | "info" | "log" | "debug" | "trace"`
- Default: `"log"`
- Env override: `LOG_LEVEL`
- Notes: controls which console methods are emitted (`error` and `metrics`
  always emit)
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### logSecondsBetweenMetrics

- Scope: logger
- Type: number (`>= 0`)
- Default: `500`
- Env override: `LOG_SECONDS_BETWEEN_METRICS`
- Notes: `0` disables periodic metrics writes
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### logPriorityThresholdBytes

- Scope: logger
- Type: number (`>= 10`)
- Default: `1048576` (1 MiB)
- Env override: `LOG_PRIORITY_THRESHOLD_BYTES`
- Notes: when queue size exceeds threshold, flushing is prioritized immediately
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### logMeta

- Scope: logger
- Type: `Record<string, string> | null`
- Default: `null`
- Env override: none
- Notes: merged into emitted `context.meta`; merged shallowly on updates
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### logObjects

- Scope: logger
- Type: boolean (`true/false/yes/no` accepted by parser)
- Default: `false`
- Env override: `LOG_OBJECTS`
- Notes: logs objects directly to console; forces `logSecondsBetweenMetrics=0`
  when enabled
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### logPretty

- Scope: logger
- Type: boolean (`true/false/yes/no`)
- Default: `false`
- Env override: `LOG_PRETTY`
- Notes: pretty-prints JSON logs via `console.log`
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### logWithConsole

- Scope: logger
- Type: boolean (`true/false/yes/no`)
- Default: `false`
- Env override: `LOG_WITH_CONSOLE`
- Notes: bypasses queue and writes via `console.log(JSON.stringify(...))`
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

### silentInit

- Scope: logger
- Type: boolean (`true/false/yes/no`)
- Default: `false`
- Env override: none
- Notes: intended to suppress init/update debug logs. Current implementation
  does not apply `initLogger({ silentInit })` into `newConfig`, so this setting
  is effectively always defaulted during init.
- Source: `src/zod.ts`, `src/dare-console-logger.ts`

## Environment Variables

### LOG_LEVEL

- Maps to: `logLevel`
- Example: `LOG_LEVEL=info`
- Source: `src/dare-console-logger.ts`, `README.md`

### LOG_SECONDS_BETWEEN_METRICS

- Maps to: `logSecondsBetweenMetrics`
- Example: `LOG_SECONDS_BETWEEN_METRICS=60`
- Source: `src/dare-console-logger.ts`, `README.md`

### LOG_PRIORITY_THRESHOLD_BYTES

- Maps to: `logPriorityThresholdBytes`
- Example: `LOG_PRIORITY_THRESHOLD_BYTES=262144`
- Source: `src/dare-console-logger.ts`

### LOG_OBJECTS

- Maps to: `logObjects`
- Example: `LOG_OBJECTS=true`
- Source: `src/dare-console-logger.ts`, `README.md`

### LOG_PRETTY

- Maps to: `logPretty`
- Example: `LOG_PRETTY=true`
- Source: `src/dare-console-logger.ts`, `README.md`

### LOG_WITH_CONSOLE

- Maps to: `logWithConsole`
- Example: `LOG_WITH_CONSOLE=true`
- Source: `src/dare-console-logger.ts`, `README.md`

## Express Middleware Settings (`expressLoggerMiddleware`)

### doNotLogURLs (express)

- Scope: Express middleware
- Type: `RegExp`
- Default: unset
- Notes: skip logging for matching `req.originalUrl`
- Source: `src/express.ts`

## Fresh Middleware Settings (`freshV1LoggerPlugin`)

### setCookies (fresh)

- Scope: Fresh middleware
- Type: `Cookie[]`
- Default: unset
- Notes: additional cookies appended to response
- Source: `src/fresh.ts`

### doNotLogURLs (fresh)

- Scope: Fresh middleware
- Type: `RegExp`
- Default: unset
- Notes: skip logging for matching route path
- Source: `src/fresh.ts`

## Hono Middleware Settings (`honoLoggerMiddleware`)

### doNotLogURLs (hono)

- Scope: Hono middleware
- Type: `RegExp`
- Default: unset
- Notes: skip logging for matching request path
- Source: `src/hono.ts`

## SolidStart Middleware Settings (`solidStartLoggerMiddleware`)

### doNotLogURLs (solidstart)

- Scope: SolidStart middleware
- Type: `RegExp`
- Default: unset
- Notes: skip logging for matching request path
- Source: `src/solidstart.ts`

## Request Context Inputs (Header/Cookie Driven)

### x-request-id

- Scope: request context
- Default/fallback: generated `"<app>-<timestamp>-<rand>"`
- Source: `src/utils.ts`

### x-trace-path

- Scope: request context
- Type: comma-separated list
- Default/fallback: `[requestId]` when request id is generated
- Source: `src/utils.ts`

### x-correlation-id / correlationId cookie

- Scope: request context
- Default/fallback: `"unknown"`
- Source: `src/utils.ts`

### authorization / session cookie

- Scope: request context
- Notes: extracts `sessionId` from token payload when present
- Default/fallback: `"unknown"`
- Source: `src/utils.ts`

### x-application-name / applicationName cookie

- Scope: request context
- Default/fallback: `"postman"` for Postman user-agent; otherwise `"unknown"`
- Source: `src/utils.ts`

### x-application-version / applicationVersion cookie

- Scope: request context
- Default/fallback: `"unknown"`
- Source: `src/utils.ts`

### user-agent

- Scope: request context
- Default/fallback: `"unknown"`
- Source: `src/utils.ts`

## Implementation Notes

- `LoggingConfig` type in `src/zod.ts` does not currently include
  `logWithConsole`, but runtime schema/config uses it.
- `silentInit` exists in schema/type, but is not wired into `initLogger`'s
  `newConfig` object.
