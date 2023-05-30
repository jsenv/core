import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer } from "@jsenv/server";
import { parseServerTimingHeader } from "@jsenv/server/src/server_timing/timing_header.js";

const noContentService = (request) => {
  if (request.pathname !== "/") return null;
  return { status: 204 };
};

const okService = (request) => {
  if (request.pathname !== "/whatever") return null;
  return { status: 200 };
};

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  serverTiming: true,
  services: [
    { name: "service:no content", handleRequest: noContentService },
    { name: "service:ok", handleRequest: okService },
  ],
});

{
  const response = await fetchUrl(origin);
  const actual = {
    status: response.status,
    timing: parseServerTimingHeader(response.headers.get("server-timing")),
  };
  const expected = {
    status: 204,
    timing: {
      a: {
        description: "service:no content.handleRequest",
        duration: actual.timing.a.duration,
      },
      b: {
        description: "time to start responding",
        duration: actual.timing.b.duration,
      },
    },
  };
  assert({ actual, expected });
}

{
  const response = await fetchUrl(`${origin}/whatever`);
  const actual = {
    status: response.status,
    timing: parseServerTimingHeader(response.headers.get("server-timing")),
  };
  const expected = {
    status: 200,
    timing: {
      a: {
        description: "service:no content.handleRequest",
        duration: actual.timing.a.duration,
      },
      b: {
        description: "service:ok.handleRequest",
        duration: actual.timing.b.duration,
      },
      c: {
        description: "time to start responding",
        duration: actual.timing.c.duration,
      },
    },
  };
  assert({ actual, expected });
}
