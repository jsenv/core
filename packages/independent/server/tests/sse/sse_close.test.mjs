import { assert } from "@jsenv/assert";

import { startServer, createSSERoom } from "@jsenv/server";
import { openEventSource, closeEventSource } from "./sse_test_helpers.mjs";

const room = createSSERoom({
  // logLevel: "debug",
  maxClientAllowed: 1,
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
room.sendEventToAllClients({
  type: "test",
  data: 42,
});
{
  const actual = room.getRoomClientCount();
  const expect = 1;
  assert({ actual, expect });
}
await closeEventSource(eventSource);
await new Promise((resolve) => setTimeout(resolve, 100));
{
  const actual = room.getRoomClientCount();
  const expect = 0;
  assert({ actual, expect });
}

const eventSource2 = await openEventSource(server.origin);
{
  const actual = room.getRoomClientCount();
  const expect = 1;
  assert({ actual, expect });
}
await closeEventSource(eventSource2);
