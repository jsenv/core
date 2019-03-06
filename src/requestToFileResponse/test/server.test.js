import path from "path"
import { startServer } from "../../server/index.js"
import { requestToFileResponse } from "../requestToFileResponse.js"

const root = path.resolve(__dirname, "../../../")
const filenameRelative = "src/__test__/file.js"

;(async () => {
  const server = await startServer({
    protocol: "http",
    port: 3000,
    requestToResponse: (request) =>
      requestToFileResponse(request, {
        root,
        cacheStrategy: "etag",
      }),
  })

  console.log("server opened at", server.origin)
  console.log(`open ${server.origin}/${filenameRelative} in a browser`)
})()
