import { asyncLocalStorage, storeItemFromRequest } from "./utils.ts";
import { type Cookie, setCookie } from "@std/http";

/**
 * Options for the fresh logger
 * @param setCookies - a list of cookies to set on the response
 * @param doNotLogURLs - a regex to match URLs that should not be logged
 */
export type FreshV1Options = {
  setCookies?: Cookie[];
  doNotLogURLs?: RegExp;
};

/**
 * Add a request logger to a fresh app
 * @param options
 */
function freshV1LoggerMiddleware(
  options?: FreshV1Options,
  // deno-lint-ignore no-explicit-any
): (req: any, ctx: any) => Promise<Response> {
  return async (
    req,
    ctx,
  ) => {
    if (ctx.destination !== "route") {
      return await ctx.next();
    }
    const url = new URL(req.url);

    if (options?.doNotLogURLs?.test(url.pathname)) {
      return await ctx.next();
    }

    const storeItem = storeItemFromRequest(
      req.headers,
      {
        method: req.method,
        path: url.pathname,
      },
    );
    if (storeItem.trace.correlationId) {
      storeItem.trace.correlationId = crypto.randomUUID();
    }

    let response;
    await asyncLocalStorage.run(storeItem, async () => {
      response = await ctx.next();

      if (response) {
        const resHeaders = response.headers;

        setCookie(resHeaders, {
          name: "correlationId",
          value: storeItem.trace.correlationId,
          sameSite: "Strict",
          domain: url.hostname,
          path: "/",
          secure: ctx.url.protocol === "https:",
        });

        if (options?.setCookies) {
          for (const cookie of options.setCookies) {
            setCookie(resHeaders, cookie);
          }
        }

        // let theBody = req.body || "probably form";

        console.log(`request end ${req.method} ${url.pathname}`, {
          request: {
            method: req.method,
            path: url.pathname,
            search: url.search,
            // body: theBody,
          },
          response: {
            statusMessage: response.statusText,
            statusCode: response.status || "unknown",
            // TODO, it's a stream
            // body: response.body || "empty body",
          },
        });
      }
    });

    return response!;
  };
}

export function freshV1LoggerPlugin(
  options?: FreshV1Options,
) {
  return {
    name: "daringwayFreshLoggerPlugin",
    middlewares: [
      {
        path: "/",
        middleware: { handler: freshV1LoggerMiddleware(options) },
      },
    ],
  };
}
