import { createAction, all, passed } from "@dmail/action"
import fs from "fs"
import crypto from "crypto"

export const createEtag = (string) => {
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

const getFileContentEtag = (location) => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      throw error
    } else {
      action.pass(String(buffer))
    }
  })

  return action.then(createEtag)
}

export const eTagValidator = ({ staticLocation, dynamicLocation, eTag: dynamicEtag }) => {
  return all([getFileContentEtag(staticLocation), passed(dynamicEtag)]).then(
    ([staticEtag, dynamicEtag]) => {
      const detail = {
        staticLocation,
        dynamicLocation,
        staticEtag,
        dynamicEtag,
      }

      if (dynamicEtag === staticEtag) {
        return {
          valid: true,
          reason: "etag-match",
          detail,
        }
      }
      return {
        valid: false,
        reason: "etag-mismatch",
        detail,
      }
    },
  )
}
