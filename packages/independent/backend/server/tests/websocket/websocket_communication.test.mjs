// organize-imports-ignore
import { assert } from "@jsenv/assert";
import { requestCertificate } from "@jsenv/https-local";

import { startServer, WebSocketResponse } from "@jsenv/server";
import { WebSocket } from "ws";

const run = async (params) => {
  let messageFromClientToServerPromise;
  const server = await startServer({
    logLevel: "warn",
    routes: [
      {
        endpoint: "GET /",
        fetch: () => {
          return new WebSocketResponse((websocket) => {
            messageFromClientToServerPromise = new Promise((resolve) => {
              websocket.on("message", (buffer) => {
                resolve(String(buffer));
              });
            });
            websocket.send("hello client");
          });
        },
      },
    ],
    keepProcessAlive: false,
    ...params,
  });

  const wsClient = new WebSocket(server.webSocketOrigin, {
    rejectUnauthorized: false, // allow self signed cert
  });

  try {
    const connectionOpenedPromise = new Promise((resolve) => {
      wsClient.on("open", resolve);
    });
    const messageFromServerToClientPromise = new Promise((resolve) => {
      wsClient.on("message", (buffer) => {
        resolve(String(buffer));
      });
    });
    await connectionOpenedPromise;
    wsClient.send("hello server");
    const actual = {
      messageFromClientToServer: await messageFromClientToServerPromise,
      messageFromServerToClient: await messageFromServerToClientPromise,
    };
    const expect = {
      messageFromClientToServer: "hello server",
      messageFromServerToClient: "hello client",
    };
    assert({ actual, expect });
  } finally {
    wsClient.close();
  }
};

// http
await run();

// https
// certificates only generated on linux
if (!process.env.CI || process.platform === "linux") {
  const { certificate, privateKey } = requestCertificate();
  await run({
    https: { certificate, privateKey },
  });
}
