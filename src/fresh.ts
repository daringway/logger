import { asyncLocalStorage, storeItemFromRequest } from "./utils.ts";
import type { FreshContext, Plugin } from "$fresh/server.ts";
import { type Cookie, setCookie } from "@std/http";

export type FreshOptions = {
  setCookies?: Cookie[];
  doNotLogURLs?: RegExp;
};

function freshLoggerMiddleware(
  options?: FreshOptions,
): (req: Request, ctx: FreshContext) => Promise<Response> {
  return async (
    req: Request,
    ctx: FreshContext,
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

export function freshLoggerPlugin(
  options?: FreshOptions,
): Plugin {
  return {
    name: "daringwayFreshLoggerPlugin",
    middlewares: [
      {
        path: "/",
        middleware: { handler: freshLoggerMiddleware(options) },
      },
    ],
  };
}
