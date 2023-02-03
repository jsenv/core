import { requestCertificate } from "@jsenv/https-local"
import { startDevServer } from "@jsenv/core"

export const startTestServer = async (rest) => {
  const { certificate, privateKey } = requestCertificate()
  const testServer = await startDevServer({
    logLevel: "warn",
    protocol: "https",
    certificate,
    privateKey,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    clientAutoreload: false,
    supervisor: false,
    ...rest,
  })
  return testServer
}
