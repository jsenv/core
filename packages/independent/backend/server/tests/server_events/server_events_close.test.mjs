import { assert } from "@jsenv/assert";

import { ServerEvents, startServer } from "@jsenv/server";
import { closeEventSource, openEventSource } from "./sse_test_helpers.mjs";

const serverEvents = new ServerEvents({
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
      fetch: serverEvents.fetch,
    },
  ],
});
const eventSource = await openEventSource(server.origin);
serverEvents.sendEventToAllClients({
  type: "test",
  data: 42,
});
{
  const actual = serverEvents.getClientCount();
  const expect = 1;
  assert({ actual, expect });
}
await closeEventSource(eventSource);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = serverEvents.getClientCount();
  const expect = 0;
  assert({ actual, expect });
}

const eventSource2 = await openEventSource(server.origin);
{
  const actual = serverEvents.getClientCount();
  const expect = 1;
  assert({ actual, expect });
}
await closeEventSource(eventSource2);
