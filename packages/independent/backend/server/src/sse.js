import { createLogger } from "@jsenv/humanize";
import { createObservable } from "./interfacing_with_node/observable.js";
import { WebSocketResponse } from "./web_socket_response.js";

export class SSE {
  constructor(...args) {
    // eslint-disable-next-line no-constructor-return
    return createSSE(...args);
  }
}

// https://www.html5rocks.com/en/tutorials/eventsource/basics/
export const createSSE = ({
  producer,
  logLevel,
  // do not keep process alive because of event source, something else must keep it alive
  keepProcessAlive = false,
  keepaliveDuration = 30 * 1000,
  retryDuration = 1 * 1000,
  historyLength = 1 * 1000,
  maxClientAllowed = 100, // max 100 clients accepted
  computeEventId = (event, lastEventId) => lastEventId + 1,
  welcomeEventEnabled = false,
  welcomeEventPublic = false, // decides if welcome event are sent to other clients
  actionOnClientLimitReached = "refuse", // "kick-oldest" or "refuse"
} = {}) => {
  const logger = createLogger({ logLevel });

  const serverEventSource = {
    closed: false,
  };
  const clientArray = new Set();
  const eventHistory = createEventHistory(historyLength);
  // what about previousEventId that keeps growing ?
  // we could add some limit
  // one limit could be that an event older than 24h is deleted
  let previousEventId = 0;
  let interval;
  let producerReturnValue;

  const addClient = (client) => {
    if (clientArray.length === 0) {
      if (typeof producer === "function") {
        producerReturnValue = producer({
          sendEvent: sendEventToAllClients,
        });
      }
    }
    clientArray.push(client);
    logger.debug(
      `A client has joined. Number of client: ${clientArray.length}`,
    );
    if (client.lastKnownId !== undefined) {
      const previousEvents = getAllEventSince(client.lastKnownId);
      const eventMissedCount = previousEvents.length;
      if (eventMissedCount > 0) {
        logger.info(
          `send ${eventMissedCount} event missed by client since event with id "${client.lastKnownId}"`,
        );
        for (const previousEvent of previousEvents) {
          client.sendEvent(previousEvent);
        }
      }
    }
    if (welcomeEventEnabled) {
      const welcomeEvent = {
        retry: retryDuration,
        type: "welcome",
        data: new Date().toLocaleTimeString(),
      };
      addEventToHistory(welcomeEvent);

      // send to everyone
      if (welcomeEventPublic) {
        sendEventToAllClients(welcomeEvent, {
          history: false,
        });
      }
      // send only to this client
      else {
        client.sendEvent(welcomeEvent);
      }
    } else {
      const firstEvent = {
        retry: retryDuration,
        type: "comment",
        data: new Date().toLocaleTimeString(),
      };
      client.sendEvent(firstEvent);
    }
  };
  const removeClient = (client) => {
    const index = clientArray.indexOf(client);
    if (index === -1) {
      return;
    }
    clientArray.splice(index, 1);
    logger.debug(`A client left. Number of client: ${clientArray.length}`);
    if (clientArray.length === 0) {
      if (typeof producerReturnValue === "function") {
        producerReturnValue();
        producerReturnValue = undefined;
      }
    }
  };

  const fetch = (request) => {
    if (clientArray.length >= maxClientAllowed) {
      if (actionOnClientLimitReached === "refuse") {
        return {
          status: 503,
        };
      }
      // "kick-oldest"
      const oldestClient = clientArray.shift();
      oldestClient.close();
    }

    if (serverEventSource.closed) {
      return {
        status: 204,
      };
    }

    const lastKnownId =
      request.headers["last-event-id"] ||
      request.searchParams.get("last-event-id");

    if (request.headers["upgrade"] === "websocket") {
      return new WebSocketResponse((websocket) => {
        const webSocketClient = {
          type: "websocket",
          lastKnownId,
          request,
          websocket,
          sendEvent: (event) => {
            websocket.write(JSON.stringify(event));
          },
          close: () => {
            websocket.close();
          },
        };
        addClient(webSocketClient);
        return () => {
          removeClient(webSocketClient);
        };
      });
    }
    if (request.headers["accept"].includes("text/event-stream")) {
      return {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          "connection": "keep-alive",
        },
        body: createObservable(({ next, complete, addTeardown }) => {
          const client = {
            type: "event_source",
            lastKnownId,
            request,
            sendEvent: (event) => {
              next(stringifySourceEvent(event));
            },
            close: () => {
              complete(); // will terminate the http connection as body ends
            },
          };
          addClient(client);
          addTeardown(() => {
            removeClient(client);
          });
        }),
      };
    }
    return {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
      body: createObservable(({ next, complete, addTeardown }) => {
        const client = {
          type: "http",
          lastKnownId,
          request,
          sendEvent: (event) => {
            next(JSON.stringify(event));
          },
          close: () => {
            complete();
          },
        };
        addClient(client);
        addTeardown(() => {
          removeClient(client);
        });
      }),
    };
  };

  const addEventToHistory = (event) => {
    if (typeof event.id === "undefined") {
      event.id = computeEventId(event, previousEventId);
    }
    previousEventId = event.id;
    eventHistory.add(event);
  };

  const sendEventToAllClients = (event, { history = true } = {}) => {
    if (history) {
      addEventToHistory(event);
    }
    logger.debug(`send "${event.type}" event to ${clientArray.size} client(s)`);
    for (const client of clientArray) {
      client.sendEvent(event);
    }
  };

  const getAllEventSince = (id) => {
    const events = eventHistory.since(id);
    if (welcomeEventEnabled && !welcomeEventPublic) {
      return events.filter((event) => event.type !== "welcome");
    }
    return events;
  };

  const keepAlive = () => {
    // maybe that, when an event occurs, we can delay the keep alive event
    logger.debug(
      `send keep alive event, number of client listening this event source: ${clientArray.length}`,
    );
    sendEventToAllClients(
      {
        type: "comment",
        data: new Date().toLocaleTimeString(),
      },
      { history: false },
    );
  };

  const open = () => {
    if (!serverEventSource.closed) {
      return;
    }
    interval = setInterval(keepAlive, keepaliveDuration);
    if (!keepProcessAlive) {
      interval.unref();
    }
    serverEventSource.closed = false;
  };

  const close = () => {
    if (serverEventSource.closed) {
      return;
    }
    logger.debug(`closing, number of client : ${clientArray.length}`);
    for (const client of clientArray) {
      client.close();
    }
    clientArray.length = 0;
    clearInterval(interval);
    eventHistory.reset();
    serverEventSource.closed = true;
  };

  Object.assign(serverEventSource, {
    // main api:
    // - ability to sendEvent to clients in the room
    // - ability to join the room
    // - ability to leave the room
    sendEventToAllClients,
    fetch,

    // should rarely be necessary, get information about the room
    getAllEventSince,
    getClientCount: () => clientArray.length,

    // should rarely be used
    close,
    open,
  });
  return serverEventSource;
};

// https://github.com/dmail-old/project/commit/da7d2c88fc8273850812972885d030a22f9d7448
// https://github.com/dmail-old/project/commit/98b3ae6748d461ac4bd9c48944a551b1128f4459
// https://github.com/dmail-old/http-eventsource/blob/master/lib/event-source.js
// http://html5doctor.com/server-sent-events/
const stringifySourceEvent = ({ data, type = "message", id, retry }) => {
  let string = "";

  if (id !== undefined) {
    string += `id:${id}\n`;
  }

  if (retry) {
    string += `retry:${retry}\n`;
  }

  if (type !== "message") {
    string += `event:${type}\n`;
  }

  string += `data:${data}\n\n`;

  return string;
};

const createEventHistory = (limit) => {
  const events = [];

  const add = (data) => {
    events.push(data);

    if (events.length >= limit) {
      events.shift();
    }
  };

  const since = (id) => {
    const index = events.findIndex((event) => String(event.id) === id);
    return index === -1 ? [] : events.slice(index + 1);
  };

  const reset = () => {
    events.length = 0;
  };

  return { add, since, reset };
};
