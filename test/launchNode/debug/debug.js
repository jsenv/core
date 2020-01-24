import { createRequire } from "module"

const require = createRequire(import.meta.url)

const log = require("why-is-node-running")

debugger

log()

console.log(`before`)

// eslint-disable-next-line no-debugger
debugger

console.log("after")
