import { asyncLocalStorage, storeItemFromRequest } from "./utils.ts";

/**
 * Options for the Hono logger
 * @param doNotLogURLs - a regex to match URLs that should not be logged
 */
export type HonoOptions = {
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

type HonoLikeContext = {
  req: {
    raw: Request;
    path?: string;
    method?: string;
  };
  res: Response;
  header(name: string, value: string): void;
};

type HonoLikeNext = () => Promise<void>;

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
 * Add a request logger to a Hono app
 * @param options
 */
export function honoLoggerMiddleware(
  options?: HonoOptions,
): (ctx: HonoLikeContext, next: HonoLikeNext) => Promise<void> {
  return async (ctx, next): Promise<void> => {
    const req = ctx.req.raw;
    const url = new URL(req.url);
    const path = ctx.req.path || url.pathname;

    if (options?.doNotLogURLs?.test(path)) {
      await next();
      return;
    }

    const storeItem = storeItemFromRequest(
      req.headers,
      { method: req.method, path },
    );
    ctx.header("x-request-id", storeItem.trace.requestId);

    await asyncLocalStorage.run(storeItem, async () => {
      console.trace(() => {
        return [
          `api request start ${path}`,
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
        await next();
        console.info(
          `request end ${req.method} ${path}`,
          { metrics: storeItem.metrics?.getMetrics() || {} },
          resLogData(req, ctx.res, path, "success"),
        );
      } catch (error) {
        console.error(
          `request end error ${path}`,
          resLogData(req, ctx.res, path, "error"),
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
  };
}
