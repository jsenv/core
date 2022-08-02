import { requestCertificate } from "@jsenv/https-local"

import { startBuildServer } from "@jsenv/core"

const { certificate, privateKey } = requestCertificate({ altNames: ["local"] })
await startBuildServer({
  logLevel: "info",
  port: "9999",
  protocol: "https",
  certificate,
  privateKey,
  acceptAnyIp: true,
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  // minification: false,
  // versioning: false,
})
