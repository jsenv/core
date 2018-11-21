import { open } from "./serverCompile.js"
import path from "path"

const localRoot = path.resolve(__dirname, "../../../")

open({
  localRoot,
  into: "build",
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
}).then(({ origin }) => {
  console.log(`compiling ${localRoot} at ${origin}`)
})
