import { assert } from "@jsenv/assert";
import { SSE, startServer } from "@jsenv/server";
import { closeEventSource, openEventSource } from "./sse_test_helpers.mjs";

const sse = new SSE({
  // logLevel: "debug",
  maxClientAllowed: 1,
});
const server = await startServer({
  // logLevel: "debug",
  logLevel: "warn",
  keepProcessAlive: false,
  routes: [
    {
      endpoint: "GET *",
      fetch: sse.fetch,
    },
  ],
});
const eventSource = await openEventSource(server.origin);
sse.sendEventToAllClients({
  type: "test",
  data: 42,
});
{
  const actual = sse.getClientCount();
  const expect = 1;
  assert({ actual, expect });
}
await closeEventSource(eventSource);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = sse.getClientCount();
  const expect = 0;
  assert({ actual, expect });
}

const eventSource2 = await openEventSource(server.origin);
{
  const actual = sse.getClientCount();
  const expect = 1;
  assert({ actual, expect });
}
await closeEventSource(eventSource2);
