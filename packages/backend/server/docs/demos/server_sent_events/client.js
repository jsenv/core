import { EventSource } from "eventsource";

const eventSource = new EventSource("http://localhost:3456/events");
eventSource.addEventListener("ping", (event) => {
  console.log("> ping from server", event.lastEventId, JSON.parse(event.data));
});
