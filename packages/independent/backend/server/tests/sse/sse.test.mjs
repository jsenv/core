import { assert } from "@jsenv/assert";
import { createSSERoom, startServer } from "@jsenv/server";
import { closeEventSource, openEventSource } from "./sse_test_helpers.mjs";

const timeEllapsedPromise = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// a client is notified from an event
{
  const room = createSSERoom();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          return room.join(request);
        },
      },
    ],
  });
  const eventSource = await openEventSource(server.origin);
  room.sendEventToAllClients({
    data: 42,
  });
  await timeEllapsedPromise(200);
  const [firstMessageEvent] = eventSource.getAllMessageEvents();
  const actual = {
    type: firstMessageEvent.type,
    data: firstMessageEvent.data,
    lastEventId: firstMessageEvent.lastEventId,
    origin: firstMessageEvent.origin,
  };
  const expect = {
    type: "message",
    data: "42",
    lastEventId: "1",
    origin: server.origin,
  };
  assert({ actual, expect });
  await closeEventSource(eventSource);
  room.close();
}

// a client is notified of events occuring while he is disconnected
{
  const room = createSSERoom({
    logLevel: "warn",
  });
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          return room.join(request);
        },
      },
    ],
  });
  let eventSource = await openEventSource(server.origin);
  room.sendEventToAllClients({
    type: "message",
    data: 42,
  });
  await timeEllapsedPromise(200);
  const [firstMessageEvent] = eventSource.getAllMessageEvents();
  await closeEventSource(eventSource);
  room.sendEventToAllClients({
    type: "message",
    data: true,
  });
  await timeEllapsedPromise(200);

  eventSource = await openEventSource(
    `${server.origin}?last-event-id=${firstMessageEvent.lastEventId}`,
  );
  await timeEllapsedPromise(200);
  const [secondMessageEvent] = eventSource.getAllMessageEvents();

  const actual = {
    type: secondMessageEvent.type,
    data: secondMessageEvent.data,
    lastEventId: secondMessageEvent.lastEventId,
    origin: secondMessageEvent.origin,
  };
  const expect = {
    type: "message",
    data: "true",
    lastEventId: "2",
    origin: server.origin,
  };
  assert({ actual, expect });

  {
    const actual = room.getRoomClientCount();
    const expect = 1;
    assert({ actual, expect });
  }

  await closeEventSource(eventSource);
  await timeEllapsedPromise(200);
  // ensure event source is properly closed
  // and room takes that into accout
  {
    const actual = room.getRoomClientCount();
    const expect = 0;
    assert({ actual, expect });
  }
  room.close();
}

// a server can have many rooms and client can connect the one he wants
{
  const roomA = createSSERoom();
  const roomB = createSSERoom();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          if (request.pathname === "/roomA") {
            return roomA.join(request);
          }
          if (request.pathname === "/roomB") {
            return roomB.join(request);
          }
          return null;
        },
      },
    ],
  });
  const roomAEventSource = await openEventSource(`${server.origin}/roomA`);
  const roomBEventSource = await openEventSource(`${server.origin}/roomB`);
  roomA.sendEventToAllClients({
    type: "message",
    data: "a",
  });
  roomB.sendEventToAllClients({
    type: "message",
    data: "b",
  });
  await timeEllapsedPromise(200);

  {
    const actual = roomAEventSource.getAllMessageEvents();
    const expect = [
      {
        type: "message",
        data: "a",
        lastEventId: "1",
        origin: server.origin,
      },
    ];
    assert({ actual, expect });
  }
  {
    const actual = roomBEventSource.getAllMessageEvents();
    const expect = [
      {
        type: "message",
        data: "b",
        lastEventId: "1",
        origin: server.origin,
      },
    ];
    assert({ actual, expect });
  }

  await closeEventSource(roomAEventSource);
  await closeEventSource(roomBEventSource);
  roomA.close();
  roomB.close();
}

// a room can have many clients
{
  const room = createSSERoom();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          return room.join(request);
        },
      },
    ],
  });
  const clientA = await openEventSource(server.origin);
  const clientB = await openEventSource(server.origin);
  room.sendEventToAllClients({
    type: "message",
    data: 42,
  });
  await timeEllapsedPromise(200);
  {
    const actual = room.getRoomClientCount();
    const expect = 2;
    assert({ actual, expect });
  }
  const clientAEvents = clientA.getAllMessageEvents();
  const clientBEvents = clientB.getAllMessageEvents();
  {
    const actual = clientAEvents;
    const expect = [
      {
        type: "message",
        data: "42",
        lastEventId: "1",
        origin: server.origin,
      },
    ];
    assert({ actual, expect });
  }
  {
    const actual = clientBEvents;
    const expect = [
      {
        type: "message",
        data: "42",
        lastEventId: "1",
        origin: server.origin,
      },
    ];
    assert({ actual, expect });
  }

  await closeEventSource(clientA);
  await closeEventSource(clientB);
  room.close();
}

// there can be a limit to number of clients (100 by default)
{
  const room = createSSERoom({
    maxClientAllowed: 1,
  });
  const server = await startServer({
    logLevel: "off",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          return room.join(request);
        },
      },
    ],
  });
  const clientA = await openEventSource(server.origin);
  try {
    await openEventSource(server.origin);
    throw new Error("expect to throw");
  } catch (errorEvent) {
    const actual = {
      type: errorEvent.type,
      code: errorEvent.code,
      message: errorEvent.message,
    };
    const expect = {
      type: "error",
      code: 503,
      message: "Non-200 status code (503)",
    };
    assert({ actual, expect });
  } finally {
    await closeEventSource(clientA);
    room.close();
  }
}

// test whats happens with a room that is not started or is stopped
{
  const room = createSSERoom();
  room.close();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          return room.join(request);
        },
      },
    ],
  });
  try {
    await openEventSource(server.origin);
    throw new Error("expect to throw");
  } catch (errorEvent) {
    const actual = {
      type: errorEvent.type,
      code: errorEvent.code,
      message: errorEvent.message,
    };
    const expect = {
      type: "error",
      code: 204,
      message: "Server sent HTTP 204, not reconnecting",
    };
    assert({ actual, expect });
  }
}
