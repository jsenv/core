import { EventSource } from "eventsource";

const eventsourceUrl = "https://localhost:3456";

const eventSource = new EventSource(eventsourceUrl, {
  https: { rejectUnauthorized: false },
});

eventSource.addEventListener("ping", ({ lastEventId }) => {
  console.log("> ping from server", { lastEventId });
});
