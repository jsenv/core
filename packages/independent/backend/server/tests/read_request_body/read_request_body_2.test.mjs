import { assert } from "@jsenv/assert";
import { startServer } from "@jsenv/server";

const server = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  routes: [
    {
      endpoint: "POST *",
      fetch: async (request) => {
        const requestBody = await request.text();
        return new Response(`${requestBody} world`);
      },
    },
  ],
});
const response = await fetch(server.origin, { method: "POST", body: "Hello" });
const actual = await response.text();
const expect = "Hello world";
assert({ actual, expect });
