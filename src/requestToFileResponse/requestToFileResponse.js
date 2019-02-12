import { createReadStream } from "fs"
import { folderRead, fileStat, fileRead } from "@dmail/helper"
import { createETag } from "../compileToService/helpers.js"
import { convertFileSystemErrorToResponseProperties } from "./convertFileSystemErrorToResponseProperties.js"
import { ressourceToContentType } from "./ressourceToContentType.js"

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString()

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}

export const requestToFileResponse = async (
  { origin, ressource, method, headers = {} },
  {
    root,
    locate = ({ requestFile, root }) => `${root}/${requestFile}`,
    canReadDirectory = false,
    getFileStat = fileStat,
    getFileContentAsString = fileRead,
    fileToBody = createReadStream,
    cacheStrategy = "mtime",
  },
) => {
  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    }
  }

  try {
    const file = await locate({ requestFile: ressource, root, remoteRoot: origin })

    if (!file) {
      return {
        status: 404,
      }
    }

    // redirection to other origin
    if (!file.startsWith(`${root}/`)) {
      return {
        status: 307,
        headers: {
          location: file,
        },
      }
    }

    // redirection to same origin
    const fileRessource = file.slice(`${root}/`.length)
    if (fileRessource !== ressource) {
      return {
        status: 307,
        headers: {
          location: `${origin}/${fileRessource}`,
        },
      }
    }

    const cacheWithMtime = cacheStrategy === "mtime"
    const cacheWithETag = cacheStrategy === "etag"
    const cachedDisabled = cacheStrategy === "none"
    const stat = await getFileStat(file)

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

      const files = await folderRead(file)
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
          "content-type": ressourceToContentType(ressource),
        },
        body: fileToBody(file),
      }
    }

    if (cacheWithETag) {
      const content = await getFileContentAsString(file)
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
          "content-type": ressourceToContentType(ressource),
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
        "content-type": ressourceToContentType(ressource),
      },
      body: fileToBody(file),
    }
  } catch (e) {
    return convertFileSystemErrorToResponseProperties(e)
  }
}
