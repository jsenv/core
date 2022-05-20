import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)

const { bundle } = require("@parcel/css")

const { code } = await bundle({
  filename: fileURLToPath(new URL("./client/elements.css", import.meta.url)),
  minify: false,
})
console.log(String(code))
