import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const browserslist = require("browserslist")

const b = browserslist(
  "defaults and supports es6-module and supports es6-module-dynamic-import, not opera > 0, not samsung > 0, not and_qq > 0",
)
console.log(b)
