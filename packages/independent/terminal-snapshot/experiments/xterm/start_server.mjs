import { startServer, fetchFileSystem } from "@jsenv/server";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate();

const serverDirectoryUrl = new URL("./", import.meta.url);
await startServer({
  logLevel: "info",
  port: 0,
  https: { certificate, privateKey },
  services: [
    {
      handleRequest: async (request) => {
        const fileUrl = new URL(request.resource.slice(1), serverDirectoryUrl);
        const response = await fetchFileSystem(fileUrl, request);
        return response;
      },
    },
  ],
});
