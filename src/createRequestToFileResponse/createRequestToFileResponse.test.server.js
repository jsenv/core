import { openServer } from "../openServer/index.js"
import { createRequestToFileResponse } from "./createRequestToFileResponse.js"
import path from "path"

const root = path.resolve(__dirname, "../../../")
const service = createRequestToFileResponse({
  root,
  cacheStrategy: "etag",
})
const ressource = "src/__test__/file.js"

openServer({
  protocol: "http",
  port: 3000,
  requestToResponse: service,
}).then((server) => {
  console.log("server opened at", server.origin)
  console.log(`open ${server.origin}/${ressource} in a browser`)
})
