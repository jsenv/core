import path from "path"
import { openCompileServer } from "./openCompileServer.js"

const rootLocation = path.resolve(__dirname, "../../../")

openCompileServer({
  url: "http://127.0.0.1:8998",
  rootLocation,
}).then(({ url }) => {
  console.log(`server listening, waiting for client at ${url}`)
})
