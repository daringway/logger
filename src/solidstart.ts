import { asyncLocalStorage, storeItemFromRequest } from "./utils.ts";

/**
 * Options for the SolidStart logger
 * @param doNotLogURLs - a regex to match URLs that should not be logged
 */
export type SolidStartOptions = {
  doNotLogURLs?: RegExp;
};

type HJson =
  | string
  | number
  | boolean
  | Date
  | null
  | { [key: string]: HJson }
  | HJson[];

type SolidStartLikeEvent = {
  request: Request;
  response: Response;
  locals?: Record<string, unknown>;
  url?: URL;
};

const SOLIDSTART_LOGGER_STATE = "__daringwayLogger";

type SolidStartLoggerState = {
  skip: boolean;
  path: string;
  requestUrl: string;
  requestMethod: string;
  requestId: string;
  storeItem?: ReturnType<typeof storeItemFromRequest>;
};

function withHeader(response: Response, key: string, value: string): Response {
  try {
    response.headers.set(key, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set(key, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

function setLoggerState(
  event: SolidStartLikeEvent,
  state: SolidStartLoggerState,
): void {
  if (!event.locals) {
    event.locals = {};
  }
  event.locals[SOLIDSTART_LOGGER_STATE] = state;
}

function getLoggerState(
  event: SolidStartLikeEvent,
): SolidStartLoggerState | null {
  if (!event.locals) {
    return null;
  }
  const state = event.locals[SOLIDSTART_LOGGER_STATE];
  if (!state || typeof state !== "object") {
    return null;
  }
  return state as SolidStartLoggerState;
}

function resLogData(
  req: Request,
  response: Response,
  path: string,
  status: string,
): Record<string, HJson> {
  const url = new URL(req.url);
  return {
    type: "api_call",
    status,
    request: {
      method: req.method,
      path: path,
      search: url.search,
    },
    response: {
      statusMessage: response.statusText || "unknown",
      statusCode: response.status || "unknown",
    },
  };
}

/**
 * Add request/response logging hooks for SolidStart middleware.
 * Use with: createMiddleware(solidStartLoggerMiddleware()).
 * @param options
 */
export function solidStartLoggerMiddleware(
  options?: SolidStartOptions,
): {
  onRequest: (event: SolidStartLikeEvent) => void;
  onBeforeResponse: (event: SolidStartLikeEvent) => void;
} {
  return {
    onRequest: (event: SolidStartLikeEvent): void => {
      const req = event.request;
      const url = event.url ?? new URL(req.url);

      if (options?.doNotLogURLs?.test(url.pathname)) {
        setLoggerState(event, {
          skip: true,
          path: url.pathname,
          requestUrl: req.url,
          requestMethod: req.method,
          requestId: "",
        });
        return;
      }

      const storeItem = storeItemFromRequest(
        req.headers,
        { method: req.method, path: url.pathname },
      );

      if (
        typeof (asyncLocalStorage as { enterWith?: (store: unknown) => void })
          .enterWith === "function"
      ) {
        (asyncLocalStorage as { enterWith: (store: unknown) => void })
          .enterWith(
            storeItem,
          );
      }

      event.response = withHeader(
        event.response,
        "x-request-id",
        storeItem.trace.requestId,
      );

      setLoggerState(event, {
        skip: false,
        path: url.pathname,
        requestUrl: req.url,
        requestMethod: req.method,
        requestId: storeItem.trace.requestId,
        storeItem,
      });

      console.trace(() => {
        return [
          `api request start ${url.pathname}`,
          {
            type: "request",
            request: {
              method: req.method,
              url: req.url,
            },
          },
        ];
      });
    },
    onBeforeResponse: (event: SolidStartLikeEvent): void => {
      const state = getLoggerState(event);
      if (!state || state.skip) {
        return;
      }

      const req = event.request;
      const response = withHeader(
        event.response,
        "x-request-id",
        state.requestId,
      );

      const logFn = response.status >= 500 ? console.error : console.info;
      const levelStatus = response.status >= 500 ? "error" : "success";

      if (state.storeItem) {
        asyncLocalStorage.run(state.storeItem, () => {
          logFn(
            `request end ${state.requestMethod} ${state.path}`,
            { metrics: state.storeItem?.metrics?.getMetrics() || {} },
            resLogData(req, response, state.path, levelStatus),
          );
        });
      } else {
        logFn(
          `request end ${state.requestMethod} ${state.path}`,
          resLogData(req, response, state.path, levelStatus),
        );
      }
    },
  };
}
