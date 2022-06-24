import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startBuildServer } from "@jsenv/core"

const { certificate, privateKey } = requestCertificateForLocalhost({
  altNames: ["local"],
})

await startBuildServer({
  logLevel: "info",
  port: "9999",
  protocol: "https",
  certificate,
  privateKey,
  listenAnyIp: true,
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  // minification: false,
  // versioning: false,
  buildServerAutoreload: true,
  buildServerMainFile: import.meta.url,
})
