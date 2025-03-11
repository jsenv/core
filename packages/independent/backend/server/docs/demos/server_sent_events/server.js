import { ServerEvents, startServer } from "@jsenv/server";

const serverEvents = new ServerEvents();
setInterval(() => {
  serverEvents.sendEventToAllClients({
    type: "ping",
  });
}, 1000);

startServer({
  logLevel: "warn",
  port: 3456,
  routes: [
    {
      endpoint: "GET *",
      fetch: serverEvents.fetch,
    },
  ],
});
