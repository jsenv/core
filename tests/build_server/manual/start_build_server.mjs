import { requestCertificate } from "@jsenv/https-local"

import { startBuildServer } from "@jsenv/core"

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] })
await startBuildServer({
  logLevel: "info",
  port: "9999",
  https: { certificate, privateKey },
  acceptAnyIp: true,
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  // minification: false,
  // versioning: false,
})
