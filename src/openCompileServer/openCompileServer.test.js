import path from "path"
import { openCompileServer } from "./openCompileServer.js"

const root = path.resolve(__dirname, "../../../")

openCompileServer({
  root,
  cacheFolder: "build",
  compileFolder: "build__dynamic__",
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
}).then(({ origin }) => {
  console.log(`compiling ${root} at ${origin}`)
})
