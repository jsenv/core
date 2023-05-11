import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer, timeFunction } from "@jsenv/server";
import { parseServerTimingHeader } from "@jsenv/server/src/server_timing/timing_header.js";

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  serverTiming: true,
  services: [
    {
      name: "toto",
      handleRequest: async () => {
        const [waitTiming] = await timeFunction("waiting 50ms", async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
        });

        return {
          status: 200,
          timing: waitTiming,
        };
      },
    },
  ],
});

{
  const response = await fetchUrl(origin);
  const actual = parseServerTimingHeader(response.headers.get("server-timing"));
  const expected = {
    a: {
      description: "toto.handleRequest",
      duration: actual.a.duration,
    },
    b: {
      description: "waiting 50ms",
      duration: actual.b.duration,
    },
    c: {
      description: "time to start responding",
      duration: actual.c.duration,
    },
  };
  assert({ actual, expected });
}
