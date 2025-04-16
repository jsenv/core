import { assert } from "@jsenv/assert";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { startServer } from "@jsenv/server";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
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
          fetch: async (request, { timing }) => {
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
      description: "open_file.routing",
      duration: assert.between(0, 500),
    },
    c: {
      description: "route_inspector.routing",
      duration: assert.between(0, 500),
    },
    d: {
      description: "internal_client_files.routing",
      duration: assert.between(0, 500),
    },
    e: {
      description: "autoreload_on_server_restart.routing",
      duration: assert.between(0, 500),
    },
    f: {
      description: "toto.routing",
      duration: assert.between(0, 500),
    },
    g: {
      description: "waiting 50ms",
      duration: assert.between(30, 80),
    },
  };
  assert({ actual, expect });
}
