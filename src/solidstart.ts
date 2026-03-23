import { asyncLocalStorage, storeItemFromRequest } from "./utils.ts";

/**
 * Options for the SolidStart logger
 * @param doNotLogURLs - a regex to match URLs that should not be logged
 */
export type SolidStartOptions = {
  doNotLogURLs?: RegExp;
  /**
   * When omitted, defaults to true.
   */
  logStaticRequestsAtStart?: boolean;
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
  url?: URL;
};

type SolidStartLoggerState = {
  skip: boolean;
  path: string;
  requestMethod: string;
  requestId: string;
  storeItem?: ReturnType<typeof storeItemFromRequest>;
};

const requestState = new WeakMap<Request, SolidStartLoggerState>();

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

function isLikelyStaticRequest(pathname: string): boolean {
  if (
    pathname.startsWith("/assets/") || pathname.startsWith("/_build/") ||
    pathname.startsWith("/public/")
  ) {
    return true;
  }
  return /\.[a-zA-Z0-9]{1,8}$/.test(pathname);
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
  const resolvedOptions:
    & Required<Pick<SolidStartOptions, "logStaticRequestsAtStart">>
    & Omit<SolidStartOptions, "logStaticRequestsAtStart"> = {
      logStaticRequestsAtStart: true,
      ...options,
    };

  return {
    onRequest: (event: SolidStartLikeEvent): void => {
      const req = event.request;
      const url = event.url ?? new URL(req.url);

      if (resolvedOptions.doNotLogURLs?.test(url.pathname)) {
        requestState.set(req, {
          skip: true,
          path: url.pathname,
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

      requestState.set(req, {
        skip: false,
        path: url.pathname,
        requestMethod: req.method,
        requestId: storeItem.trace.requestId,
        storeItem,
      });

      if (
        resolvedOptions.logStaticRequestsAtStart &&
        isLikelyStaticRequest(url.pathname)
      ) {
        asyncLocalStorage.run(storeItem, () => {
          console.info(
            `request start ${req.method} ${url.pathname}`,
            {
              type: "api_call",
              status: "start",
              request: {
                method: req.method,
                path: url.pathname,
                search: url.search,
              },
              response: {
                statusMessage: "pending",
                statusCode: "pending",
              },
            },
          );
        });
      } else {
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
      }
    },
    onBeforeResponse: (event: SolidStartLikeEvent): void => {
      const req = event.request;
      let state = requestState.get(req);

      if (!state) {
        const url = event.url ?? new URL(req.url);
        if (resolvedOptions.doNotLogURLs?.test(url.pathname)) {
          return;
        }
        const storeItem = storeItemFromRequest(
          req.headers,
          { method: req.method, path: url.pathname },
        );
        state = {
          skip: false,
          path: url.pathname,
          requestMethod: req.method,
          requestId: storeItem.trace.requestId,
          storeItem,
        };
      }

      if (!state || state.skip) {
        return;
      }

      const response = withHeader(
        event.response,
        "x-request-id",
        state.requestId,
      );
      requestState.delete(req);

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
