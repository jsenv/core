import { readFileSync as readFileSyncNode } from "node:fs"

import { assertAndNormalizeFileUrl } from "./file_url_validation.js"

export const readFileSync = (value, { as = "buffer" } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value)
  const buffer = readFileSyncNode(new URL(fileUrl))
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
