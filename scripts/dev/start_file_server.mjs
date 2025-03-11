import { requestCertificate } from "@jsenv/https-local";
import { createFileSystemFetch, startServer } from "@jsenv/server";

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] });
const directoryUrl = new URL("../../", import.meta.url).href;
await startServer({
  port: 3689,
  https: { certificate, privateKey },
  routes: [
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(directoryUrl, {
        canReadDirectory: true,
      }),
    },
  ],
});
