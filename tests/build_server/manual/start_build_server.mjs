import { startBuildServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] });
await startBuildServer({
  logLevel: "info",
  port: "9999",
  https: { certificate, privateKey },
  acceptAnyIp: true,
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  // minification: false,
  // versioning: false,
});
