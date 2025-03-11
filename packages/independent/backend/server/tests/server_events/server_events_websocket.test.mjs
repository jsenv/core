import { assert } from "@jsenv/assert";
import { ServerEvents, startServer } from "@jsenv/server";
import { WebSocket } from "ws";

// a client is notified from an event
{
  const serverEvents = new ServerEvents();
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

  const messageEvents = [];
  const ws = new WebSocket(server.webSocketOrigin, {
    rejectUnauthorized: false, // allow self signed cert
  });
  await new Promise((resolve) => {
    ws.on("open", resolve);
  });
  ws.onmessage = (m) => {
    messageEvents.push(JSON.parse(m.data));
  };
  serverEvents.sendEventToAllClients({ type: "message", data: 42 });
  await new Promise((resolve) => setTimeout(resolve, 100));

  const actual = messageEvents;
  const expect = [{ type: "message", data: 42, id: 1 }];
  assert({ actual, expect });
  ws.close();
  serverEvents.close();
}
