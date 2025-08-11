import { AsyncLocalStorage } from "node:async_hooks";
import { MetricsTracker } from "./dare-metrics.ts";
import { logConfig } from "./dare-console-logger.ts";
import { decodeBase64 } from "@std/encoding";

export const asyncLocalStorage: AsyncLocalStorage<StoreItem> =
  new AsyncLocalStorage();

export type TraceItem = {
  requestId: string;
  tracePath: string[];
  correlationId: string;
  sessionId: string;
};

export type StoreItem = {
  trace: TraceItem;
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
  // ...Record<string, unknown>;
};

// export type TraceHeaders = {
//   "x-request-id": string;
//   "x-trace-path": string;
//   "x-correlation-id": string | null;
//   "x-application-name": string;
//   "x-application-version": string;
// };

function headerArray(value: string | null) {
  if (value === undefined) {
    return [];
  } else if (typeof value === "string") {
    return value.split(",");
  } else {
    return value;
  }
}

function extractSessionId(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }
  try {
    // Split the token into parts: header, payload, signature
    const payloadBase64 = token.split(".")[1];
    const payloadString = new TextDecoder().decode(decodeBase64(payloadBase64));
    return payloadString.match(/"sessionId"\s*:\s*"([^"]+)"/)?.[1];
  } catch (error) {
    console.error("Invalid token:", error);
    return undefined;
  }
}

export function storeItemFromRequest(
  headers: { get(name: string): string | null },
  request: { method: string; path: string },
): StoreItem {
  const cookie = headers.get("cookie");

  let requestId = headers.get("x-request-id");
  let tracePath = headerArray(headers.get("x-trace-path")) || [];
  let correlationId = headers.get("x-correlation-id");
  if (!correlationId) {
    correlationId = cookie?.match(/correlationId=([^;]+)/)?.[1] || null;
    if (!correlationId) {
      correlationId = "unknown";
    }
  }

  if (!requestId) {
    requestId = `${
      logConfig?.logMeta?.applicationName || "gen"
    }-${Date.now()}-${Math.floor(10000 + Math.random() * 90000)}`;
    tracePath = [requestId];
  }

  const sessionId = extractSessionId(
    headers.get("authorization") || cookie?.match(/session=([^;]+)/)?.[1],
  ) || "unknown";

  const userAgent = headers.get("user-agent") || "unknown";
  const clientApplicationName = headers.get("x-application-name") ||
    cookie?.match(/applicationName=([^;]+)/)?.[1] ||
    (headers.get("user-agent")?.startsWith("Postman") ||
        headers.get("postman-token")
      ? "postman"
      : "unknown");
  const clientApplicationVersion = headers.get("x-application-version") ||
    cookie?.match(/applicationVersion=([^;]+)/)?.[1] || "unknown";

  return {
    trace: {
      requestId: requestId,
      tracePath: tracePath,
      correlationId,
      sessionId,
    },
    request: {
      method: request?.method || "unknown_method",
      path: request?.path || "unknown_path",
    },
    client: {
      userAgent,
      applicationName: clientApplicationName,
      applicationVersion: clientApplicationVersion,
    },
    metrics: new MetricsTracker([]),
  };
}
