// noinspection JSUnusedGlobalSymbols

import type { NextFunction, Request, Response } from "express";
import { MetricsTracker } from "./dare-metrics.ts";
import { asyncLocalStorage, storeItemFromRequest } from "./utils.ts";

/**
 * Options for the express logger
 * @param doNotLogURLs - a regex to match URLs that should not be logged
 */
export type ExpressOptions = {
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

function resLogData(
  req: Request,
  res: Response,
  status: string,
): Record<string, HJson> {
  return {
    type: "api_call",
    status: status,

    request: {
      method: req.method,
      path: req.originalUrl,
      search: req.query as HJson,
      body: req.body as HJson,
    },
    response: {
      statusMessage: res.statusMessage,
      statusCode: res.statusCode || "unknown",
      // TODO not logging all responses
      body: res.locals.body || "empty body",
    },
  };
}

/**
 * Add a request logger to an express app
 * @param options
 * @returns
 */
export function expressLoggerMiddleware(
  options?: ExpressOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (options?.doNotLogURLs?.test(req.originalUrl)) {
      next();
      return;
    }

    // Using it for elapseTime
    res.locals.metrics = new MetricsTracker([]);

    // res.on("error"), (err: Error) => {
    // }

    // Listen for the finish event, which indicates that the response has been sent
    res.on("finish", () => {
      if (res.locals.error) {
        const error = res.locals.error;
        console.error(
          `request end error ${req.originalUrl}`,
          resLogData(req, res, "error"),
          { metrics: res.locals.metrics.getMetrics() },
          // status: "internal error",
          {
            javascriptError: {
              message: error.message,
              event: error.event,
              data: JSON.parse(JSON.stringify(error)),
              stack: error.stack || "no stack trace",
            },
          },
        );
      } else {
        console.info(
          `request end ${req.method} ${req.originalUrl}`,
          { metrics: res.locals.metrics.getMetrics() },
          resLogData(req, res, "success"),
        );
      }
    });

    // @ts-ignore req has .get(field) function
    const storeItem = storeItemFromRequest(
      // @ts-ignore this works
      req,
      { method: req.method, path: req.path },
    );
    res.setHeader("x-request-id", storeItem.trace.requestId);

    asyncLocalStorage.run(storeItem, () => {
      next();

      // We log on a callback, so it's not executed unless trace debugging is enabled
      console.trace(() => {
        return [
          `api request start ${req.path}`,
          {
            type: "request",
            request: {
              method: req.method,
              url: req.originalUrl,
            },
          },
        ];
      });
    });
  };
}
