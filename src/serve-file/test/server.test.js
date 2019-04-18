import path from "path"
import { startServer } from "../../server/index.js"
import { serveFile } from "../serveFile.js/index.js"

const root = path.resolve(__dirname, "../../../")
const filenameRelative = "src/__test__/file.js"

const server = await startServer({
  protocol: "http",
  port: 3000,
  requestToResponse: ({ ressource }) =>
    serveFile(`${root}${ressource}`, {
      cacheStrategy: "etag",
    }),
})
