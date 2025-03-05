import { assert } from "@jsenv/assert";
import { startServer } from "@jsenv/server";

const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  services: [
    {
      name: "redirect",
      redirectRequest: () => {
        // you're not allowed to mutate a request object
        // however in some specific cirsumtances in can be handy to mutate the request
        // that will be used for services coming after a given service
        return {
          pathname: "/toto.js",
        };
      },
    },
  ],
  routes: [
    {
      endpoint: "GET *",
      fetch: (request) => {
        return new Response(request.resource);
      },
    },
  ],
});
const response = await fetch(server.origin);
const actual = await response.text();
const expect = "/toto.js";
assert({ actual, expect });
