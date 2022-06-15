import { promisify } from "node:util"
import { readFile as readFileNode } from "node:fs"

import { assertAndNormalizeFileUrl } from "./assertAndNormalizeFileUrl.js"

const readFilePromisified = promisify(readFileNode)
export const readFile = async (value, { as = "buffer" } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value)
  const buffer = await readFilePromisified(new URL(fileUrl))
  if (as === "buffer") {
    return buffer
  }
  if (as === "string") {
    return buffer.toString()
  }
  if (as === "json") {
    return JSON.parse(buffer.toString())
  }
  throw new Error(
    `"as" must be one of "buffer","string","json" received "${as}"`,
  )
}
