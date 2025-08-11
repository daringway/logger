---
draft: true
slug: README
created_at: 2025-08-10T12:05:31.361Z
updated_at: 2025-08-10T12:05:31.361Z
published_at: 2025-08-10T12:05:31.361Z
body_hash: 057c85d1836c6298763af14603ce68793820a8bb807d21dff6f6d9b630916b3f
---

"logtest": "time npx ts-node -r tsconfig-paths/register ./src/logTest.ts >
x.out"

## LogLevels

Level includes all previous levels. Example: warn will log metrics, error, and
warn

- metrics: Keeping tabs on the numbers and performance stats
- error: Uh-oh, something went wrong! Think of it like the 'outer safety net'
  catching unexpected surprises.
- warn: Heads up! Something's not quite right, but we're still okay for now.
- info: Just keeping you posted—things like the service starting up or shutting
  down.
- log: Everyday chatter—like requests coming in and going out, nothing out of
  the ordinary.
- debug: Developer-level love. The nitty-gritty details only developers adore.
- trace: Super-detailed breadcrumbs—like tracking function calls or variable
  values.

## Trace IDs

logName: (header/cookie (x-) name or source)

For browser, created by client happens in fresh for page loads, or in javascript
for direct API calls

- requestId (x-request-id): created by client per API call
- tracePath (x-trace-path): the calling requestId, null on first API call, API
  will set parentId to unknown if requestId is not present
- correlationId (x-correlation-id): this is client managed, future API could
  require. For browser app, fresh will set cookie on first page load.

- sessionId (bearer token): Per active user, stored in bearer token, fresh
  resets bearer

Related:

- requestApplicationName (x-application-name) the calling application or API
- requestAapplicationVersion (x-application-version) the calling application or
  API verison
- userId (n/a) (bearer token, do not log use through sessionIDs?

1. Request page /activities (fresh server) Fresh creates session tracer
   (user:sessionId)
2. Response sets session tracer cookie ()
