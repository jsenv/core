/**
 * https://www.html5rocks.com/en/tutorials/eventsource/basics/
 *
 */

import { createLogger } from "@jsenv/humanize";
import { createObservable } from "./interfacing_with_node/observable.js";
import { WebSocketResponse } from "./web_socket_response.js";

export class ServerEvents {
  constructor(...args) {
    // eslint-disable-next-line no-constructor-return
    return createServerEvents(...args);
  }
}

export class LazyServerEvents {
  constructor(producer, options = {}) {
    const serverEvents = createServerEvents({
      producer,
      ...options,
    });
    // eslint-disable-next-line no-constructor-return
    return {
      fetch: serverEvents.fetch,
    };
  }
}

/**
 * Creates a Server-Sent Events (SSE) controller that manages client connections and event distribution.
 *
 * @param {Object} options - Configuration options for the SSE controller
 * @param {Function} [options.producer] - Function called when first client connects, receives an object with a sendEvent method
 * @param {String} [options.logLevel] - Controls logging verbosity ('debug', 'info', 'warn', 'error', etc.)
 * @param {Boolean} [options.keepProcessAlive=false] - If true, prevents Node.js from exiting while SSE connections are active
 * @param {Number} [options.keepaliveDuration=30000] - Milliseconds between keepalive messages to prevent connection timeout
 * @param {Number} [options.retryDuration=1000] - Suggested client reconnection delay in milliseconds
 * @param {Number} [options.historyLength=1000] - Maximum number of events to keep in history for reconnecting clients
 * @param {Number} [options.maxClientAllowed=100] - Maximum number of concurrent client connections allowed
 * @param {Function} [options.computeEventId] - Function to generate event IDs, receives (event, lastEventId) and returns new ID
 * @param {Boolean} [options.welcomeEventEnabled=false] - Whether to send a welcome event to new clients
 * @param {Boolean} [options.welcomeEventPublic=false] - If true, welcome events are broadcast to all clients, not just the new one
 * @param {String} [options.actionOnClientLimitReached='refuse'] - Action when client limit is reached ('refuse' or 'kick-oldest')
 *
 * @returns {Object} SSE controller with the following methods:
 * @returns {Function} .sendEventToAllClients - Sends an event to all connected clients
 * @returns {Function} .fetch - Handles HTTP requests and upgrades them to SSE/WebSocket connections
 * @returns {Function} .getAllEventSince - Retrieves events since a specific ID
 * @returns {Function} .getClientCount - Returns the number of connected clients
 * @returns {Function} .close - Closes all connections and stops the controller
 * @returns {Function} .open - Reopens the controller after closing
 *
 * @example
 * // Basic usage with auto-producer
 * const sseController = createSSE({
 *   producer: ({sendEvent}) => {
 *     const interval = setInterval(() => {
 *       sendEvent({
 *         type: "update",
 *         data: JSON.stringify({ timestamp: Date.now() })
 *       });
 *     }, 2000);
 *
 *     // Return cleanup function
 *     return () => clearInterval(interval);
 *   }
 * });
 *
 * // Use in server route
 * {
 *   endpoint: "GET /events",
 *   response: (request) => sseController.fetch(request)
 * }
 */
const createServerEvents = ({
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
  welcomeEventPublic = false,
  actionOnClientLimitReached = "refuse",
} = {}) => {
  const logger = createLogger({ logLevel });

  const serverEventSource = {
    closed: false,
  };
  const clientArray = [];
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
    const isWebsocketUpgradeRequest =
      request.headers["upgrade"] === "websocket";
    const isEventSourceRequest =
      request.headers["accept"].includes("text/event-stream");
    if (!isWebsocketUpgradeRequest && !isEventSourceRequest) {
      return {
        status: 400,
        body: "Bad Request, this endpoint only accepts WebSocket or EventSource requests",
      };
    }

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
    if (isWebsocketUpgradeRequest) {
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
    // event source request
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
