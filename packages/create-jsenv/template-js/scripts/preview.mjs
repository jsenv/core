import { parentPort } from "node:worker_threads"
import { startBuildServer } from "@jsenv/core"
import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { rootDirectoryUrl } from "../../jsenv.config.mjs"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

export const server = await startBuildServer({
  logLevel: process.env.LOG_LEVEL,
  protocol: "https",
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  rootDirectoryUrl,
  buildDirectoryUrl: new URL("./dist/", rootDirectoryUrl),
  buildServerMainFile: import.meta.url,
  // disable autoreload when inside worker thread (happen when launched by performance.mjs)
  buildServerAutoreload: !parentPort,
})
