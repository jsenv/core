import path from "path"
import { openCompileServer } from "./openCompileServer.js"

openCompileServer({
  url: "http://127.0.0.1:8998",
  rootLocation: `${path.resolve(__dirname, "../../../")}`,
}).then(({ url }) => {
  console.log(`server listening, waiting for client at ${url}`)
})
