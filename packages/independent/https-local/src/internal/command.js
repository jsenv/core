import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

export const commandExists = async (command) => {
  const { sync } = require("command-exists")
  const exists = sync(command)
  return exists
}
