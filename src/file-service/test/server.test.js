import path from "path"
import { startServer } from "../../server/index.js"
import { serveFile } from "../serve-file.js"

const root = path.resolve(__dirname, "../../../")

await startServer({
  protocol: "http",
  port: 3000,
  requestToResponse: ({ ressource }) =>
    serveFile(`${root}${ressource}`, {
      cacheStrategy: "etag",
    }),
})
