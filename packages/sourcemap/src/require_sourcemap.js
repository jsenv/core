import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
// consider using https://github.com/7rulnik/source-map-js

export const requireSourcemap = () => {
  const namespace = require("source-map-js")
  return namespace
}
