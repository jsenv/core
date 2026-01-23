import { requestCertificate } from "@jsenv/https-local";
import { connect } from "node:http2";

import { createFileSystemFetch, startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

if (process.env.CI && process.platform !== "linux") {
  // certificates only generated on linux
  process.exit();
}

const { certificate, privateKey } = requestCertificate();
const run = async () => {
  const server = await startServer({
    https: { certificate, privateKey },
    http2: true,
    keepProcessAlive: false,
    services: [
      {
        onResponsePush: ({ path }, { prevent }) => {
          if (path === "/preventme") {
            prevent();
          }
        },
      },
    ],
    routes: [
      {
        endpoint: "GET *",
        fetch: async (request, helpers) => {
          if (request.pathname === "/main.html") {
            helpers.pushResponse({ path: "/preventme" });
            helpers.pushResponse({ path: "/style.css" });
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
          return createFileSystemFetch(import.meta.resolve("./"), {
            canReadDirectory: true,
          })(request, helpers);
        },
      },
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
  client1.destroy();

  return {
    responseBodyAsString,
    pushedHeaders,
  };
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    return run();
  });
});
