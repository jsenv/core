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
  listenAnyIp: true,
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  // minification: false,
  // versioning: false,
  buildServerAutoreload: true,
  buildServerMainFile: import.meta.url,
})
