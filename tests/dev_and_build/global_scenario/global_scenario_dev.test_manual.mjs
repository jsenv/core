import { startDevServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate();
await startDevServer({
  https: { privateKey, certificate },
  sourceDirectoryUrl: new URL("client/", import.meta.url),
});
