import { EventSource } from "eventsource";
import { Agent, fetch } from "undici";

const eventsourceUrl = "https://localhost:3456";
const eventSource = new EventSource(eventsourceUrl, {
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      dispatcher: new Agent({
        connect: {
          rejectUnauthorized: false,
        },
      }),
    }),
});

eventSource.addEventListener("ping", ({ lastEventId }) => {
  console.log("> ping from server", { lastEventId });
});
