import { startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const startCookieServer = async (routes) => {
  return startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes,
  });
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  // --- request.cookies (read from incoming request) ---

  test("request.cookies returns undefined when no cookie header", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request) => {
          const value = request.cookies.get("session");
          return new Response(String(value));
        },
      },
    ]);
    const response = await fetch(server.origin);
    return {
      status: response.status,
      body: await response.text(),
    };
  });

  test("request.cookies reads cookie from request header", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request) => {
          const value = request.cookies.get("session");
          return new Response(value);
        },
      },
    ]);
    const response = await fetch(server.origin, {
      headers: { cookie: "session=abc123" },
    });
    return {
      status: response.status,
      body: await response.text(),
    };
  });

  test("request.cookies reads correct cookie among multiple", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request) => {
          const a = request.cookies.get("a");
          const b = request.cookies.get("b");
          const c = request.cookies.get("c");
          return Response.json({ a, b, c });
        },
      },
    ]);
    const response = await fetch(server.origin, {
      headers: { cookie: "a=1; b=2; c=3" },
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  });

  // --- responseCookies (write to outgoing response) ---

  test("responseCookies.set adds set-cookie response header", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request, { responseCookies }) => {
          responseCookies.set("session", "abc123");
          return new Response("ok");
        },
      },
    ]);
    const response = await fetch(server.origin);
    return {
      status: response.status,
      setCookie: response.headers.get("set-cookie"),
    };
  });

  test("responseCookies.set with options", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request, { responseCookies }) => {
          responseCookies.set("session", "abc123", {
            path: "/",
            httpOnly: true,
            secure: true,
            maxAge: 3600,
            sameSite: "Strict",
          });
          return new Response("ok");
        },
      },
    ]);
    const response = await fetch(server.origin);
    return {
      status: response.status,
      setCookie: response.headers.get("set-cookie"),
    };
  });

  test("responseCookies.delete sends expired set-cookie header", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request, { responseCookies }) => {
          responseCookies.delete("session");
          return new Response("ok");
        },
      },
    ]);
    const response = await fetch(server.origin);
    return {
      status: response.status,
      setCookie: response.headers.get("set-cookie"),
    };
  });

  test("multiple responseCookies.set produce multiple set-cookie headers", async () => {
    const server = await startCookieServer([
      {
        endpoint: "GET /",
        fetch: (request, { responseCookies }) => {
          responseCookies.set("a", "1");
          responseCookies.set("b", "2");
          responseCookies.set("c", "3");
          return new Response("ok");
        },
      },
    ]);
    const response = await fetch(server.origin);
    return {
      status: response.status,
      setCookieHeaders: response.headers.getSetCookie
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie"),
    };
  });
});
