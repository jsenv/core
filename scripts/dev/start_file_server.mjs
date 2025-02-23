import { requestCertificate } from "@jsenv/https-local";
import { fetchFileSystem, startServer } from "@jsenv/server";

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] });
const directoryUrl = new URL("../../", import.meta.url).href;
await startServer({
  port: 3689,
  https: { certificate, privateKey },
  routes: [
    {
      endpoint: "GET *",
      response: (request) => {
        return fetchFileSystem(
          new URL(request.resource.slice(1), directoryUrl),
          {
            rootDirectoryUrl: directoryUrl,
            headers: request.headers,
            canReadDirectory: true,
          },
        );
      },
    },
  ],
});
