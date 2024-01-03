import { startDevServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate();

await startDevServer({
  sourceDirectoryUrl: new URL("./", import.meta.url),
  https: { certificate, privateKey },
});
