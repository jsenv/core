import { startDevServer } from "@jsenv/core"
import { requestCertificate } from "@jsenv/https-local"

const { certificate, privateKey } = requestCertificate()
await startDevServer({
  https: { privateKey, certificate },
  rootDirectoryUrl: new URL("./", import.meta.url),
  sourceDirectoryPath: "client/",
})
