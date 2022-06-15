/*
 * - Buffer documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/buffer.html
 * - eTag documentation on MDN
 *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
 */

import { createHash } from "node:crypto"

const ETAG_FOR_EMPTY_CONTENT = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"'

export const bufferToEtag = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`)
  }

  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT
  }

  const hash = createHash("sha1")
  hash.update(buffer, "utf8")

  const hashBase64String = hash.digest("base64")
  const hashBase64StringSubset = hashBase64String.slice(0, 27)
  const length = buffer.length

  return `"${length.toString(16)}-${hashBase64StringSubset}"`
}
