import { localRoot } from "../localRoot.js"
import { open } from "./serverCompile.js"

open({
  localRoot,
  into: "build",
  protocol: "http",
  ip: "127.0.0.1",
  port: 8998,
}).then(({ origin }) => {
  console.log(`compiling ${localRoot} at ${origin}`)
})
