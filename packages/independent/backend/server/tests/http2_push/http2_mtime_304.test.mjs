import { requestCertificate } from "@jsenv/https-local";
import { createFileSystemFetch, startServer } from "@jsenv/server";
import { snapshotTests } from "@jsenv/snapshot";
import { connect } from "node:http2";

if (process.env.CI && process.platform !== "linux") {
  // certificates only generated on linux
  process.exit();
}

const { certificate, privateKey } = requestCertificate();
const run = async () => {
  const server = await startServer({
    logLevel: "warn",
    https: { certificate, privateKey },
    http2: true,
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        fetch: (request, helpers) => {
          if (request.pathname === "/main.html") {
            helpers.pushResponse({ path: "/script.js" });
            helpers.pushResponse({ path: "/style.css" });
          }
          return createFileSystemFetch(import.meta.resolve("./"), {
            canReadDirectory: true,
            mtimeEnabled: true,
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
      const clientStream = http2Client.request({
        ":path": path,
        "if-modified-since": new Date(Date.now() - 2000).toUTCString(),
      });
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

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    return run();
  });
});
