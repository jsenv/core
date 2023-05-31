import { WebSocket } from "ws";

import { requestCertificate } from "@jsenv/https-local";

import { startServer } from "@jsenv/server";
import { assert } from "@jsenv/assert";

const test = async (params) => {
  let messageFromClientToServerPromise;
  const server = await startServer({
    logLevel: "warn",
    services: [
      {
        handleWebsocket: (websocket) => {
          messageFromClientToServerPromise = new Promise((resolve) => {
            websocket.on("message", (buffer) => {
              resolve(String(buffer));
            });
          });

          websocket.send("hello client");
        },
      },
    ],
    keepProcessAlive: false,
    ...params,
  });

  const wsClient = new WebSocket(server.websocketOrigin, {
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
    const expected = {
      messageFromClientToServer: "hello server",
      messageFromServerToClient: "hello client",
    };
    assert({ actual, expected });
  } finally {
    wsClient.close();
  }
};

// http
await test();

// https
// certificates only generated on linux
if (process.platform === "linux") {
  const { certificate, privateKey } = requestCertificate();
  await test({
    https: { certificate, privateKey },
  });
}
