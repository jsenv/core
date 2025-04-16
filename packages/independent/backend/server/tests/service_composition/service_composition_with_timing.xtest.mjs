import { startServer } from "@jsenv/server";

import { parseServerTimingHeader } from "@jsenv/server/src/server_timing/timing_header.js";
import { snapshotTests } from "@jsenv/snapshot";

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
          fetch: () => {
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
          fetch: () => {
            return { status: 200 };
          },
        },
      ],
    },
  ],
});

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("0_fetch_root", async () => {
      const response = await fetch(server.origin);
      const actual = {
        status: response.status,
        timing: parseServerTimingHeader(response.headers.get("server-timing")),
      };
      return actual;
    });

    test("1_fetch_whatever", async () => {
      const response = await fetch(`${server.origin}/whatever`);
      const actual = {
        status: response.status,
        timing: parseServerTimingHeader(response.headers.get("server-timing")),
      };
      return actual;
    });
  },
  {
    throwWhenDiff: false,
  },
);
