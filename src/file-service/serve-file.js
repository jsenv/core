import { createReadStream } from "fs"
import { folderRead, fileStat, fileRead } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createETag } from "../createETag.js"
import { convertFileSystemErrorToResponseProperties } from "./convertFileSystemErrorToResponseProperties.js"
import { filenameToContentType } from "./filenameToContentType.js"

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString()

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}

export const serveFile = async (
  pathname,
  { method = "GET", headers = {}, canReadDirectory = false, cacheStrategy = "mtime" } = {},
) => {
  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    }
  }

  try {
    const cacheWithMtime = cacheStrategy === "mtime"
    const cacheWithETag = cacheStrategy === "etag"
    const cachedDisabled = cacheStrategy === "none"
    const filename = pathnameToOperatingSystemPath(pathname)

    const stat = await fileStat(filename)

    if (stat.isDirectory()) {
      if (canReadDirectory === false) {
        return {
          status: 403,
          statusText: "not allowed to read directory",
          headers: {
            ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          },
        }
      }

      const files = await folderRead(filename)
      const filesAsJSON = JSON.stringify(files)

      return {
        status: 200,
        headers: {
          ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          "content-type": "application/json",
          "content-length": filesAsJSON.length,
        },
        body: filesAsJSON,
      }
    }

    if (cacheWithMtime) {
      if ("if-modified-since" in headers) {
        let cachedModificationDate
        try {
          cachedModificationDate = new Date(headers["if-modified-since"])
        } catch (e) {
          return {
            status: 400,
            statusText: "if-modified-since header is not a valid date",
          }
        }

        const actualModificationDate = dateToSecondsPrecision(stat.mtime)
        if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
          return {
            status: 304,
          }
        }
      }

      return {
        status: 200,
        headers: {
          ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          "last-modified": dateToUTCString(stat.mtime),
          "content-length": stat.size,
          "content-type": filenameToContentType(filename),
        },
        body: createReadStream(filename),
      }
    }

    if (cacheWithETag) {
      const content = await fileRead(filename)
      const eTag = createETag(content)

      if ("if-none-match" in headers && headers["if-none-match"] === eTag) {
        return {
          status: 304,
          headers: {
            ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          },
        }
      }

      return {
        status: 200,
        headers: {
          ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          "content-length": stat.size,
          "content-type": filenameToContentType(filename),
          etag: eTag,
        },
        body: content,
      }
    }

    return {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-length": stat.size,
        "content-type": filenameToContentType(filename),
      },
      body: createReadStream(filename),
    }
  } catch (e) {
    return convertFileSystemErrorToResponseProperties(e)
  }
}
