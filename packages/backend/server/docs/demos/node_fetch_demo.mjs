import { startServer } from "@jsenv/server";

const server = await startServer({
  routes: [
    {
      endpoint: "GET *",
      fetch: () => new Response("Hello world"),
    },
  ],
});

const response = await fetch(server.origin);
const responseBodyAsText = await response.text();
console.log(responseBodyAsText); // "Hello world"
