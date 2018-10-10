import path from "path"
import { openCompileServer } from "./openCompileServer.js"

const root = path.resolve(__dirname, "../../../")

openCompileServer({
  url: "http://127.0.0.1:8998",
  root,
}).then(({ url }) => {
  console.log(`compiling ${root} at ${url}`)
})
