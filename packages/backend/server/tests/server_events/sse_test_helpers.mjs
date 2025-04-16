import { EventSource } from "eventsource";
import { Agent, fetch } from "undici";

export const openEventSource = async (url) => {
  const eventSource = new EventSource(url, {
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

  const messageEvents = [];

  eventSource.addEventListener(
    "message",
    ({ type, data, lastEventId, origin }) => {
      messageEvents.push({ type, data, lastEventId, origin });
    },
  );

  eventSource.getAllMessageEvents = () => messageEvents;

  await new Promise((resolve, reject) => {
    eventSource.onopen = () => {
      eventSource.onerror = () => {};
      eventSource.onopen = () => {};
      resolve();
    };

    eventSource.onerror = (errorEvent) => {
      if (
        eventSource.readyState === EventSource.CLOSED ||
        eventSource.readyState === EventSource.CONNECTING
      ) {
        eventSource.onerror = () => {};
        eventSource.onopen = () => {};
        reject(errorEvent);
      }
    };
  });

  return eventSource;
};

export const closeEventSource = (eventSource) => {
  return new Promise((resolve) => {
    // eventSource.onerror = (errorEvent) => {
    //   eventSource.onerror = () => {}
    //   if (eventSource.readyState === EventSource.CLOSED) {
    //     resolve()
    //   } else {
    //     reject(errorEvent)
    //   }
    // }
    eventSource.close();
    resolve();
  });
};
