import { assert } from "@jsenv/assert";
import { startServer } from "@jsenv/server";
import { parseServerTimingHeader } from "@jsenv/server/src/server_timing/timing_header.js";

const server = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  serverTiming: true,
  services: [
    {
      name: "service:no content",
      routes: [
        {
          endpoint: "GET /",
          response: () => {
            return { status: 204 };
          },
        },
      ],
    },
    {
      name: "service:ok",
      routes: [
        {
          endpoint: "GET /whatever",
          response: () => {
            return { status: 200 };
          },
        },
      ],
    },
  ],
});

{
  const response = await fetch(server.origin);
  const actual = {
    status: response.status,
    timing: parseServerTimingHeader(response.headers.get("server-timing")),
  };
  const expect = {
    status: 204,
    timing: {
      a: {
        description: "time to start responding",
        duration: assert.any(Number),
      },
      b: {
        description: "service:no content.routing",
        duration: assert.any(Number),
      },
    },
  };
  assert({ actual, expect });
}

{
  const response = await fetch(`${server.origin}/whatever`);
  const actual = {
    status: response.status,
    timing: parseServerTimingHeader(response.headers.get("server-timing")),
  };
  const expect = {
    status: 200,
    timing: {
      a: {
        description: "time to start responding",
        duration: assert.any(Number),
      },
      b: {
        description: "service:no content.routing",
        duration: assert.any(Number),
      },
      c: {
        description: "service:ok.routing",
        duration: assert.any(Number),
      },
    },
  };
  assert({ actual, expect });
}
