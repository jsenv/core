// https://nodejs.org/dist/latest-v16.x/docs/api/http2.html#server-side-example

import { connect } from "node:http2";
import { requestCertificate } from "@jsenv/https-local";
import { assert } from "@jsenv/assert";
import { readFile } from "@jsenv/filesystem";

import {
  startServer,
  fetchFileSystem,
  jsenvServiceErrorHandler,
} from "@jsenv/server";

// certificates only generated on linux
if (process.platform === "linux") {
  const { certificate, privateKey } = requestCertificate();
  const server = await startServer({
    logLevel: "warn",
    port: 3679,
    http2: true,
    https: { certificate, privateKey },

    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request, { pushResponse }) => {
          if (request.pathname === "/main.html") {
            pushResponse({ path: "/script.js" });
            pushResponse({ path: "/style.css" });
          }

          return fetchFileSystem(
            new URL(request.resource.slice(1), import.meta.url),
            {
              headers: request.headers,
              canReadDirectory: true,
            },
          );
        },
      },
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    ],
  });

  const request = async (http2Client, path) => {
    let responseBodyAsString = "";
    const pushedHeaders = [];

    await new Promise((resolve, reject) => {
      http2Client.on("error", reject);
      http2Client.on("socketError", reject);
      http2Client.on("stream", (pushedStream, headers) => {
        headers = { ...headers };
        // ignore node internal symbols
        Object.getOwnPropertySymbols(headers).forEach((symbol) => {
          delete headers[symbol];
        });
        pushedHeaders.push(headers);
      });
      const clientStream = http2Client.request({ ":path": path });
      clientStream.setEncoding("utf8");
      clientStream.on("data", (chunk) => {
        responseBodyAsString += chunk;
      });
      clientStream.on("end", () => {
        resolve();
      });
      clientStream.end();
    });

    return {
      responseBodyAsString,
      pushedHeaders,
    };
  };

  const client1 = connect(server.origin, {
    ca: certificate,
    // Node.js won't trust my custom certificate
    // We could also do this: https://github.com/nodejs/node/issues/27079
    rejectUnauthorized: false,
  });
  const { responseBodyAsString, pushedHeaders } = await request(
    client1,
    "/main.html",
  );
  client1.close();

  const actual = {
    responseBodyAsString,
    pushedHeaders,
  };
  const expected = {
    responseBodyAsString: await readFile(
      new URL("./main.html", import.meta.url),
      { as: "string" },
    ),
    pushedHeaders: [
      {
        ":path": "/script.js",
        ":method": "GET",
        ":authority": `localhost:3679`,
        ":scheme": "https",
      },
      {
        ":path": "/style.css",
        ":method": "GET",
        ":authority": `localhost:3679`,
        ":scheme": "https",
      },
    ],
  };
  assert({ actual, expected });
}
