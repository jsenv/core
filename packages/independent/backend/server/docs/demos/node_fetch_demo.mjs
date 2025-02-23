import { startServer } from "@jsenv/server";

const server = await startServer({
  services: [
    {
      handleRequest: () => {
        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
          body: "Hello world",
        };
      },
    },
  ],
});

const response = await fetch(server.origin);
const responseBodyAsText = await new Response();
console.log(responseBodyAsText); // "Hello world"
