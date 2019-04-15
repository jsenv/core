import crypto from "crypto"
import path from "path"

export const createETag = (string) => {
  if (string.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'
  }

  const hash = crypto.createHash("sha1")
  hash.update(string, "utf8")
  let result = hash.digest("base64")
  result = result.replace(/\=+$/, "")

  return `"${string.length.toString(16)}-${result}"`
}

export const isFileNotFoundError = (error) => error && error.code === "ENOENT"

export const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

export const resolvePath = (from, ...paths) => {
  return normalizeSeparation(path.join(from, ...paths))
}
