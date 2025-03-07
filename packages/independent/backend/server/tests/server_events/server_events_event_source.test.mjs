import { assert } from "@jsenv/assert";
import { ServerEvents, startServer } from "@jsenv/server";
import { closeEventSource, openEventSource } from "./sse_test_helpers.mjs";

const timeEllapsedPromise = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// a client is notified from an event
{
  const serverEvents = new ServerEvents();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: serverEvents.fetch,
      },
    ],
  });
  const eventSource = await openEventSource(server.origin);
  serverEvents.sendEventToAllClients({ data: 42 });
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
  serverEvents.close();
}

// a client is notified of events occuring while he is disconnected
{
  const serverEvents = new ServerEvents({ logLevel: "warn" });
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: serverEvents.fetch,
      },
    ],
  });
  let eventSource = await openEventSource(server.origin);
  serverEvents.sendEventToAllClients({
    type: "message",
    data: 42,
  });
  await timeEllapsedPromise(200);
  const [firstMessageEvent] = eventSource.getAllMessageEvents();
  await closeEventSource(eventSource);
  serverEvents.sendEventToAllClients({
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
    const actual = serverEvents.getClientCount();
    const expect = 1;
    assert({ actual, expect });
  }

  await closeEventSource(eventSource);
  await timeEllapsedPromise(200);
  // ensure event source is properly closed
  // and room takes that into accout
  {
    const actual = serverEvents.getClientCount();
    const expect = 0;
    assert({ actual, expect });
  }
  serverEvents.close();
}

// a server can have many rooms and client can connect the one he wants
{
  const serverEventsA = new ServerEvents();
  const serverEventsB = new ServerEvents();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET /a",
        fetch: serverEventsA.fetch,
      },
      {
        endpoint: "GET /b",
        fetch: serverEventsB.fetch,
      },
    ],
  });
  const aClientEventSource = await openEventSource(`${server.origin}/a`);
  const bClientEventSource = await openEventSource(`${server.origin}/b`);
  serverEventsA.sendEventToAllClients({
    type: "message",
    data: "a",
  });
  serverEventsB.sendEventToAllClients({
    type: "message",
    data: "b",
  });
  await timeEllapsedPromise(200);

  {
    const actual = aClientEventSource.getAllMessageEvents();
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
    const actual = bClientEventSource.getAllMessageEvents();
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

  await closeEventSource(aClientEventSource);
  await closeEventSource(bClientEventSource);
  serverEventsA.close();
  serverEventsB.close();
}

// a room can have many clients
{
  const serverEvents = new ServerEvents();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: serverEvents.fetch,
      },
    ],
  });
  const clientA = await openEventSource(server.origin);
  const clientB = await openEventSource(server.origin);
  serverEvents.sendEventToAllClients({
    type: "message",
    data: 42,
  });
  await timeEllapsedPromise(200);
  {
    const actual = serverEvents.getClientCount();
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
  serverEvents.close();
}

// there can be a limit to number of clients (100 by default)
{
  const serverEvents = new ServerEvents({
    maxClientAllowed: 1,
  });
  const server = await startServer({
    logLevel: "off",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: serverEvents.fetch,
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
    serverEvents.close();
  }
}

// test whats happens when client tries to connect a closed serverEvents
{
  const serverEvents = new ServerEvents();
  serverEvents.close();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: serverEvents.fetch,
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
