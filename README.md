# Daring Way Console Logger & Metrics

## What it is

A drop-in logging module to enhance `console.log()` that provides the following:

- All logs and metrics in JSON format to STDOUT
- Metrics Logging
- Blazing fast high-performance non-blocking STDOUT writer (benchmark a million
  log events, 301M, in 2.3s)
- Handles formating javascript error

## What it is not

- Not a framework
- Does not support log files

# Quick Start

Add to your project

```
deno add jsr:@daringway/logger
```

## For any App

In your applications entry point

```javascript
import { initLogger } from "@daringway/logger";
initLogger();
```

Start logging with `console.error`, `console.warn`, `console.log`,
`console.info`, and `console.trace`, it's that easy.

# App Server Support

Preconfigured support for ExpressJS and Fresh V1 provides the following:

- Metrics (Request and Logger)
- Log Levels
- Trace Logging
- Metadata

## ExpressJS Configuration

```javascript
import { expressLoggerMiddleware, initLogger } from "@daringway/logger";
initLogger(backendConfig.logConfig);

const app: Express = express();

// Set this up first, it registers the logger onFinsih and starts the metrics timer
app.use(expressLoggerMiddleware());
```

## Fresh V1 Configuration

In `fresh.config.ts`

```javascript
import { freshV1LoggerPlugin, initLogger } from "@daringway/logger";

initLogger();

export default defineConfig({
  plugins: [
    tailwind(),
    freshV1LoggerPlugin(),
  ],
});
```

## Request Context Information

```typescript
export type RequestContext = {
  trace: {
    requestId: string;
    tracePath: string[];
    correlationId: string;
    sessionId: string;
  };
  client: {
    userAgent: string;
    applicationName: string;
    applicationVersion: string;
  };
  request: {
    method: string;
    path: string;
  };
  metrics?: MetricsTracker<never>;
};
```

# Environment Variables

LOG_LEVEL: "error" | "warn" | "info" | "log" | "debug" | "trace" Sets the
logging level. error and metrics will always log. Default: "log"

LOG_SECONDS_BETWEEN_METRICS: number Number of seconds between automatic metrics
logging. Default: 500

LOG_OBJECTS: boolean Enable logging of full objects in trace logs. Use for
WebStorm testing. Default: false

LOG_PRETTY: boolean Enable pretty printing of logs for development. Use for CLI
testing. Default: false

# Log Levels Explained

When logging use this as a guide on which level to log at. 

0. metrics: Keeping tabs on the numbers and performance stats (always logged)
1. error: Uh-oh, something went wrong! Think of it like the 'outer safety net'
   catching unexpected surprises. (always logged)
2. warn: Heads up! Something is off, but we're still okay for now.
3. info: Just keeping you posted—things like the service starting up or shutting
   down.
4. log: Everyday chatter-like requests coming in and going out, nothing out of
   the ordinary.
5. debug: Developer-level love. The nitty-gritty details only developers adore.
6. trace: Super-detailed breadcrumbs—like tracking function calls or variable
   values.
