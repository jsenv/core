import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startBuildServer } from "@jsenv/core"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })

await startBuildServer({
  logLevel: "info",
  port: "9999",
  protocol: "https",
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  buildCommand: "node ./build.mjs",
  buildCommandLogLevel: "warn",
  // minification: false,
  // versioning: false,
})
