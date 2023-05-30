import { createLogger } from "@jsenv/log";

import {
  createObservable,
  createCompositeProducer,
} from "@jsenv/server/src/interfacing_with_node/observable.js";

// https://www.html5rocks.com/en/tutorials/eventsource/basics/
export const createSSERoom = ({
  logLevel,
  effect = () => {},
  // do not keep process alive because of rooms, something else must keep it alive
  keepProcessAlive = false,
  keepaliveDuration = 30 * 1000,
  retryDuration = 1 * 1000,
  historyLength = 1 * 1000,
  maxClientAllowed = 100, // max 100 clients accepted
  computeEventId = (event, lastEventId) => lastEventId + 1,
  welcomeEventEnabled = false,
  welcomeEventPublic = false, // decides if welcome event are sent to other clients
} = {}) => {
  const logger = createLogger({ logLevel });

  const room = {};
  const clients = new Set();
  const eventHistory = createEventHistory(historyLength);
  // what about previousEventId that keeps growing ?
  // we could add some limit
  // one limit could be that an event older than 24h is deleted
  let previousEventId = 0;
  let opened = false;
  let interval;
  let cleanupEffect = CLEANUP_NOOP;

  const join = (request) => {
    // should we ensure a given request can join a room only once?

    const lastKnownId =
      request.headers["last-event-id"] ||
      new URL(request.url).searchParams.get("last-event-id");

    if (clients.size >= maxClientAllowed) {
      return {
        status: 503,
      };
    }

    if (!opened) {
      return {
        status: 204,
      };
    }

    const sseRoomObservable = createObservable(({ next, complete }) => {
      const client = {
        next,
        complete,
        request,
      };
      if (clients.size === 0) {
        const effectReturnValue = effect();
        if (typeof effectReturnValue === "function") {
          cleanupEffect = effectReturnValue;
        } else {
          cleanupEffect = CLEANUP_NOOP;
        }
      }
      clients.add(client);
      logger.debug(
        `A client has joined. Number of client in room: ${clients.size}`,
      );

      if (lastKnownId !== undefined) {
        const previousEvents = getAllEventSince(lastKnownId);
        const eventMissedCount = previousEvents.length;
        if (eventMissedCount > 0) {
          logger.info(
            `send ${eventMissedCount} event missed by client since event with id "${lastKnownId}"`,
          );
          previousEvents.forEach((previousEvent) => {
            next(stringifySourceEvent(previousEvent));
          });
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
          next(stringifySourceEvent(welcomeEvent));
        }
      } else {
        const firstEvent = {
          retry: retryDuration,
          type: "comment",
          data: new Date().toLocaleTimeString(),
        };
        next(stringifySourceEvent(firstEvent));
      }

      return () => {
        clients.delete(client);
        if (clients.size === 0) {
          cleanupEffect();
          cleanupEffect = CLEANUP_NOOP;
        }
        logger.debug(
          `A client left. Number of client in room: ${clients.size}`,
        );
      };
    });

    const requestSSEObservable = connectRequestAndRoom(
      request,
      room,
      sseRoomObservable,
    );

    return {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        "connection": "keep-alive",
      },
      body: requestSSEObservable,
    };
  };

  const leave = (request) => {
    disconnectRequestFromRoom(request, room);
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
    logger.debug(
      `send "${event.type}" event to ${clients.size} client in the room`,
    );
    const eventString = stringifySourceEvent(event);
    clients.forEach((client) => {
      client.next(eventString);
    });
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
      `send keep alive event, number of client listening event source: ${clients.size}`,
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
    if (opened) return;
    opened = true;
    interval = setInterval(keepAlive, keepaliveDuration);
    if (!keepProcessAlive) {
      interval.unref();
    }
  };

  const close = () => {
    if (!opened) return;
    logger.debug(`closing room, number of client in the room: ${clients.size}`);
    clients.forEach((client) => client.complete());
    clients.clear();
    clearInterval(interval);
    eventHistory.reset();
    opened = false;
  };

  open();

  Object.assign(room, {
    // main api:
    // - ability to sendEvent to clients in the room
    // - ability to join the room
    // - ability to leave the room
    sendEventToAllClients,
    join,
    leave,

    // should rarely be necessary, get information about the room
    getAllEventSince,
    getRoomClientCount: () => clients.size,

    // should rarely be used
    close,
    open,
  });
  return room;
};

const CLEANUP_NOOP = () => {};

const requestMap = new Map();

const connectRequestAndRoom = (request, room, roomObservable) => {
  let sseProducer;
  let roomObservableMap;
  const requestInfo = requestMap.get(request);
  if (requestInfo) {
    sseProducer = requestInfo.sseProducer;
    roomObservableMap = requestInfo.roomObservableMap;
  } else {
    sseProducer = createCompositeProducer({
      cleanup: () => {
        requestMap.delete(request);
      },
    });
    roomObservableMap = new Map();
    requestMap.set(request, { sseProducer, roomObservableMap });
  }

  roomObservableMap.set(room, roomObservable);
  sseProducer.addObservable(roomObservable);

  return createObservable(sseProducer);
};

const disconnectRequestFromRoom = (request, room) => {
  const requestInfo = requestMap.get(request);
  if (!requestInfo) {
    return;
  }
  const { sseProducer, roomObservableMap } = requestInfo;
  const roomObservable = roomObservableMap.get(room);
  roomObservableMap.delete(room);
  sseProducer.removeObservable(roomObservable);
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
