import { startServer } from "@jsenv/server";
import { snapshotTests } from "@jsenv/snapshot";
import http from "node:http";

const sendGlobalOptionsHttpRequest = async (url) => {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(url);
    const req = http.request(
      {
        host: hostname,
        port,
        method: "OPTIONS",
        path: "*",
      },
      (res) => {
        const bodyBufferPromise = new Promise((resolve, reject) => {
          const bufferArray = [];
          res.on("data", (chunk) => {
            bufferArray.push(chunk);
          });
          res.on("end", () => {
            const bodyBuffer = Buffer.concat(bufferArray);
            resolve(bodyBuffer);
          });
          res.on("error", (e) => {
            reject(e);
          });
        });
        resolve({
          status: res.statusCode,
          headers: new Map(Object.entries(res.headers)),
          text: async () => {
            const bodyBuffer = await bodyBufferPromise;
            return String(bodyBuffer);
          },
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
};

const run = async ({ routes, optionsTarget }) => {
  const apiServer = await startServer({
    logLevel: "warn",
    routes,
    keepProcessAlive: false,
  });
  let response;
  if (optionsTarget === "*") {
    response = await sendGlobalOptionsHttpRequest(apiServer.origin);
  } else {
    response = await fetch(apiServer.origin, {
      method: "OPTIONS",
    });
  }
  const actual = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
  return actual;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", async () => {
    const routes = [
      {
        endpoint: "GET /",
      },
      {
        acceptedContentTypes: ["text/plain"],
        endpoint: "PATCH /",
      },
      {
        acceptedContentTypes: ["application/json"],
        endpoint: "POST /",
      },
    ];

    return {
      "/": await run({
        routes,
        optionsTarget: "/",
      }),
      "*": await run({
        routes,
        optionsTarget: "*",
      }),
    };
  });
});
