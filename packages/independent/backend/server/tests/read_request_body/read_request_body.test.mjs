import { assert } from "@jsenv/assert";
import { startServer } from "@jsenv/server";

// read request body as string from string
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "POST *",
        fetch: async (request) => {
          const requestBody = await request.text();
          return new Response(requestBody.toUpperCase());
        },
      },
    ],
  });
  const response = await fetch(server.origin, {
    method: "POST",
    body: "toto",
  });
  const actual = await response.text();
  const expect = "TOTO";
  assert({ actual, expect });
  server.stop();
}

// read request body as json
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "PUT *",
        fetch: async (request) => {
          const requestBody = await request.json();
          return Response.json({ foo: requestBody.foo.toUpperCase() });
        },
      },
    ],
  });
  const response = await fetch(server.origin, {
    method: "PUT",
    body: JSON.stringify({ foo: "foo" }),
    headers: {
      "content-type": "application/json",
    },
  });
  const actual = await response.json();
  const expect = { foo: "FOO" };
  assert({ actual, expect });
  server.stop();
}

// read request body as buffer
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "PATCH *",
        fetch: async (request) => {
          const requestBuffer = await request.buffer();
          return new Response(requestBuffer);
        },
      },
    ],
  });
  const response = await fetch(server.origin, {
    method: "PATCH",
    body: "toto",
  });
  const actual = Buffer.from(await response.arrayBuffer());
  const expect = Buffer.from("toto");
  assert({ actual, expect });
  server.stop();
}

// read request body a bit late
{
  let resolveReadPromise;
  const readPromise = new Promise((resolve) => {
    resolveReadPromise = resolve;
  });
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "POST *",
        fetch: async (request) => {
          await readPromise;
          const requestBody = await request.text();
          return new Response(requestBody.toUpperCase());
        },
      },
    ],
  });
  const responsePromise = fetch(server.origin, {
    method: "POST",
    body: "toto",
  });
  // wait Xms before reading the request body
  await new Promise((resolve) => setTimeout(resolve, 200));
  resolveReadPromise();
  const response = await responsePromise;
  const actual = await response.text();
  const expect = "TOTO";
  assert({ actual, expect });
  server.stop();
}
