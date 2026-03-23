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
  url?: URL;
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

function resLogData(
  req: Request,
  response: Response | null,
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
      statusMessage: response?.statusText || "unknown",
      statusCode: response?.status || "unknown",
    },
  };
}

/**
 * Add a request logger middleware for SolidStart server middleware pipelines.
 * @param options
 */
export function solidStartLoggerMiddleware(
  options?: SolidStartOptions,
): (
  event: SolidStartLikeEvent,
  next: () => Promise<Response>,
) => Promise<Response> {
  return async (
    event: SolidStartLikeEvent,
    next: () => Promise<Response>,
  ): Promise<Response> => {
    const req = event.request;
    const url = event.url ?? new URL(req.url);

    if (options?.doNotLogURLs?.test(url.pathname)) {
      return await next();
    }

    const storeItem = storeItemFromRequest(
      req.headers,
      { method: req.method, path: url.pathname },
    );

    let response: Response | null = null;

    await asyncLocalStorage.run(storeItem, async () => {
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

      try {
        response = await next();
        response = withHeader(
          response,
          "x-request-id",
          storeItem.trace.requestId,
        );

        console.info(
          `request end ${req.method} ${url.pathname}`,
          { metrics: storeItem.metrics?.getMetrics() || {} },
          resLogData(req, response, url.pathname, "success"),
        );
      } catch (error) {
        console.error(
          `request end error ${url.pathname}`,
          resLogData(req, response, url.pathname, "error"),
          { metrics: storeItem.metrics?.getMetrics() || {} },
          {
            javascriptError: {
              message: error instanceof Error ? error.message : String(error),
              data: JSON.parse(JSON.stringify(error)),
              stack: error instanceof Error ? error.stack : "no stack trace",
            },
          },
        );
        throw error;
      }
    });
    return response!;
  };
}
