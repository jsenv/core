import { createHash } from "crypto"

const EMPTY_ID = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'

export const bufferToEtag = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`)
  }

  if (buffer.length === 0) {
    return EMPTY_ID
  }

  const hash = createHash("sha1")
  hash.update(buffer, "utf8")

  const hashBase64String = hash.digest("base64")
  const hashBase64StringSubset = hashBase64String.slice(0, 27)
  const length = buffer.length

  return `"${length.toString(16)}-${hashBase64StringSubset}"`
}
