import { open } from "./serverCompile.js"
import path from "path"

const root = path.resolve(__dirname, "../../../")

open({
  root,
  into: "build",
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
}).then(({ origin }) => {
  console.log(`compiling ${root} at ${origin}`)
})
