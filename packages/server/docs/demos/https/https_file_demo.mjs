import { readFileSync } from "node:fs"
import { startServer } from "@jsenv/server"

await startServer({
  https: {
    certificate: readFileSyncAsString("./server.crt"),
    privateKey: readFileSyncAsString("./server.key"),
  },
  allowHttpRequestOnHttps: true,
  requestToResponse: (request) => {
    const clientUsesHttp = request.origin.startsWith("http:")

    return {
      status: 200,
      headers: {
        "content-type": "text/plain",
      },
      body: clientUsesHttp ? `Welcome http user` : `Welcome https user`,
    }
  },
})

function readFileSyncAsString(relativeUrl) {
  const fileUrl = new URL(relativeUrl, import.meta.url)
  return String(readFileSync(fileUrl))
}
