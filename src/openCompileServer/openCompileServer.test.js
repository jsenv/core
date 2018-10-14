import path from "path"
import { openCompileServer } from "./openCompileServer.js"

const root = path.resolve(__dirname, "../../../")

openCompileServer({
  root,
  into: "build",
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
}).then(({ url }) => {
  console.log(`compiling ${root} at ${url}`)
})
