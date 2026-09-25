import { ServerEvents, startServer } from "@jsenv/server";

const serverEvents = new ServerEvents();
setInterval(() => {
  serverEvents.sendEventToAllClients({
    type: "ping",
    data: JSON.stringify({ ts: Date.now() }),
  });
}, 1000);

await startServer({
  logLevel: "warn",
  port: 3456,
  routes: [
    {
      endpoint: "GET /events",
      fetch: serverEvents.fetch,
    },
  ],
});
