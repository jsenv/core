import { assert } from "@jsenv/assert";
import { SSE, startServer } from "@jsenv/server";
import { closeEventSource, openEventSource } from "./sse_test_helpers.mjs";

const timeEllapsedPromise = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// a client is notified from an event
{
  const sse = new SSE();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: sse.fetch,
      },
    ],
  });
  const eventSource = await openEventSource(server.origin);
  sse.sendEventToAllClients({ data: 42 });
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
  sse.close();
}

// a client is notified of events occuring while he is disconnected
{
  const sse = new SSE({ logLevel: "warn" });
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: sse.fetch,
      },
    ],
  });
  let eventSource = await openEventSource(server.origin);
  sse.sendEventToAllClients({
    type: "message",
    data: 42,
  });
  await timeEllapsedPromise(200);
  const [firstMessageEvent] = eventSource.getAllMessageEvents();
  await closeEventSource(eventSource);
  sse.sendEventToAllClients({
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
    const actual = sse.getClientCount();
    const expect = 1;
    assert({ actual, expect });
  }

  await closeEventSource(eventSource);
  await timeEllapsedPromise(200);
  // ensure event source is properly closed
  // and room takes that into accout
  {
    const actual = sse.getClientCount();
    const expect = 0;
    assert({ actual, expect });
  }
  sse.close();
}

// a server can have many rooms and client can connect the one he wants
{
  const sseA = new SSE();
  const sseB = new SSE();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET /a",
        fetch: sseA.fetch,
      },
      {
        endpoint: "GET /b",
        fetch: sseB.fetch,
      },
    ],
  });
  const aClientEventSource = await openEventSource(`${server.origin}/a`);
  const bClientEventSource = await openEventSource(`${server.origin}/b`);
  sseA.sendEventToAllClients({
    type: "message",
    data: "a",
  });
  sseB.sendEventToAllClients({
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
  sseA.close();
  sseB.close();
}

// a room can have many clients
{
  const sse = new SSE();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: sse.fetch,
      },
    ],
  });
  const clientA = await openEventSource(server.origin);
  const clientB = await openEventSource(server.origin);
  sse.sendEventToAllClients({
    type: "message",
    data: 42,
  });
  await timeEllapsedPromise(200);
  {
    const actual = sse.getClientCount();
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
  sse.close();
}

// there can be a limit to number of clients (100 by default)
{
  const sse = new SSE({
    maxClientAllowed: 1,
  });
  const server = await startServer({
    logLevel: "off",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: sse.fetch,
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
    sse.close();
  }
}

// test whats happens when client tries to connect a closed sse
{
  const sse = new SSE();
  sse.close();
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: sse.fetch,
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
