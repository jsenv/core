import { assert } from "@jsenv/assert";
import { startServer } from "@jsenv/server";
import { parseServerTimingHeader } from "@jsenv/server/src/server_timing/timing_header.js";

const server = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  serverTiming: true,
  services: [
    {
      name: "toto",
      routes: [
        {
          endpoint: "GET *",
          response: async (request, { timing }) => {
            const waitTiming = timing("waiting 50ms");
            await new Promise((resolve) => {
              setTimeout(resolve, 50);
            });
            waitTiming.end();
            return {
              status: 200,
            };
          },
        },
      ],
    },
  ],
});

{
  const response = await fetch(server.origin);
  const actual = parseServerTimingHeader(response.headers.get("server-timing"));
  const expect = {
    a: {
      description: "time to start responding",
      duration: assert.between(0, 500),
    },
    b: {
      description: "routing",
      duration: assert.between(0, 500),
    },
    c: {
      description: "toto.routing",
      duration: assert.between(0, 500),
    },
    d: {
      description: "waiting 50ms",
      duration: assert.between(30, 80),
    },
  };
  assert({ actual, expect });
}
