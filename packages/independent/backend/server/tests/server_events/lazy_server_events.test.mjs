import { assert } from "@jsenv/assert";
import { LazyServerEvents, startServer } from "@jsenv/server";
import { closeEventSource, openEventSource } from "./sse_test_helpers.mjs";

let producerCallCount = 0;
let producerCleanupCallCount = 0;
const serverEvents = new LazyServerEvents(() => {
  producerCallCount++;
  return () => {
    producerCleanupCallCount++;
  };
});
const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  routes: [
    {
      endpoint: "GET *",
      fetch: serverEvents.fetch,
    },
  ],
});

const eventSource = await openEventSource(server.origin);
{
  const actual = {
    producerCallCount,
    producerCleanupCallCount,
  };
  const expect = {
    producerCallCount: 1,
    producerCleanupCallCount: 0,
  };
  assert({ actual, expect });
}
await closeEventSource(eventSource);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = {
    producerCallCount,
    producerCleanupCallCount,
  };
  const expect = {
    producerCallCount: 1,
    producerCleanupCallCount: 1,
  };
  assert({ actual, expect });
}

const eventSource2 = await openEventSource(server.origin);
const eventSource3 = await openEventSource(server.origin);
{
  const actual = {
    producerCallCount,
    producerCleanupCallCount,
  };
  const expect = {
    producerCallCount: 2,
    producerCleanupCallCount: 1,
  };
  assert({ actual, expect });
}
await closeEventSource(eventSource2);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = {
    producerCallCount,
    producerCleanupCallCount,
  };
  const expect = {
    producerCallCount: 2,
    producerCleanupCallCount: 1,
  };
  assert({ actual, expect });
}
await closeEventSource(eventSource3);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = {
    producerCallCount,
    producerCleanupCallCount,
  };
  const expect = {
    producerCallCount: 2,
    producerCleanupCallCount: 2,
  };
  assert({ actual, expect });
}
