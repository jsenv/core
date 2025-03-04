import { requestCertificate } from "@jsenv/https-local";
import { createFileSystemRequestHandler, startServer } from "@jsenv/server";

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] });
const directoryUrl = new URL("../../", import.meta.url).href;
await startServer({
  port: 3689,
  https: { certificate, privateKey },
  routes: [
    {
      endpoint: "GET *",
      response: createFileSystemRequestHandler(directoryUrl, {
        canReadDirectory: true,
      }),
    },
  ],
});
