import { assert } from "@jsenv/assert";

import { startServer, createSSERoom } from "@jsenv/server";
import { openEventSource, closeEventSource } from "./sse_test_helpers.mjs";

let effectCallCount = 0;
let effectCleanupCallCount = 0;
const room = createSSERoom({
  // logLevel: "debug",
  effect: () => {
    effectCallCount++;
    return () => {
      effectCleanupCallCount++;
    };
  },
});
const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  services: [
    {
      handleRequest: (request) => {
        return room.join(request);
      },
    },
  ],
});

const eventSource = await openEventSource(server.origin);
{
  const actual = {
    effectCallCount,
    effectCleanupCallCount,
  };
  const expected = {
    effectCallCount: 1,
    effectCleanupCallCount: 0,
  };
  assert({ actual, expected });
}
await closeEventSource(eventSource);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = {
    effectCallCount,
    effectCleanupCallCount,
  };
  const expected = {
    effectCallCount: 1,
    effectCleanupCallCount: 1,
  };
  assert({ actual, expected });
}

const eventSource2 = await openEventSource(server.origin);
const eventSource3 = await openEventSource(server.origin);
{
  const actual = {
    effectCallCount,
    effectCleanupCallCount,
  };
  const expected = {
    effectCallCount: 2,
    effectCleanupCallCount: 1,
  };
  assert({ actual, expected });
}
await closeEventSource(eventSource2);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = {
    effectCallCount,
    effectCleanupCallCount,
  };
  const expected = {
    effectCallCount: 2,
    effectCleanupCallCount: 1,
  };
  assert({ actual, expected });
}
await closeEventSource(eventSource3);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = {
    effectCallCount,
    effectCleanupCallCount,
  };
  const expected = {
    effectCallCount: 2,
    effectCleanupCallCount: 2,
  };
  assert({ actual, expected });
}
