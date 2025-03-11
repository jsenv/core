import { startServer } from "@jsenv/server";
import { readFileSync } from "node:fs";

startServer({
  port: 7806,
  services: [
    {
      handleRequest: (request) => {
        if (request.pathname === "/" && request.method === "GET") {
          const body = readFileSync(
            new URL("./index.html", import.meta.url),
            "utf8",
          );

          return {
            status: 200,
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        }
        if (request.method === "POST") {
          const body = JSON.stringify({});
          return {
            status: 201,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        }
        return null;
      },
    },
  ],
});
