import { createETag } from "../compileToCompileFile/helpers.js"
import { convertFileSystemErrorToResponseProperties } from "./convertFileSystemErrorToResponseProperties.js"
import { ressourceToContentType } from "./ressourceToContentType.js"
import { stat, readFile, listDirectoryContent, fileToReadableStream } from "./fileHelper.js"

const dateToUTCString = (date) => {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
  return date.toUTCString()
}

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}

export const createRequestToFileResponse = (
  {
    root,
    canReadDirectory = false,
    getFileStat = stat,
    getFileContentAsString = readFile,
    fileToBody = fileToReadableStream,
    cacheIgnore = false,
    cacheStrategy = "mtime",
  } = {},
) => {
  const cacheWithMtime = cacheStrategy === "mtime"
  const cacheWithETag = cacheStrategy === "etag"

  const getContentAndETag = (fileLocation) => {
    return Promise.resolve()
      .then(() => getFileContentAsString(fileLocation))
      .then((content) => {
        return {
          content,
          eTag: createETag(content),
        }
      })
  }

  return ({ ressource, method, headers = {} }) => {
    if (method !== "GET" && method !== "HEAD") {
      return {
        status: 501,
      }
    }

    const fileLocation = `${root}/${ressource}`

    return Promise.resolve()
      .then(() => getFileStat(fileLocation))
      .then((stat) => {
        if (stat.isDirectory()) {
          if (canReadDirectory === false) {
            return {
              status: 403,
              reason: "not allowed to read directory",
              headers: {
                ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
              },
            }
          }

          return Promise.resolve()
            .then(() => listDirectoryContent(fileLocation))
            .then(JSON.stringify)
            .then((directoryListAsJSON) => {
              return {
                status: 200,
                headers: {
                  ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
                  "content-type": "application/json",
                  "content-length": directoryListAsJSON.length,
                },
                body: directoryListAsJSON,
              }
            })
        }

        if (cacheWithMtime) {
          if ("if-modified-since" in headers) {
            let cachedModificationDate
            try {
              cachedModificationDate = new Date(headers["if-modified-since"])
            } catch (e) {
              return {
                status: 400,
                reason: "if-modified-since header is not a valid date",
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
              ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
              "last-modified": dateToUTCString(stat.mtime),
              "content-length": stat.size,
              "content-type": ressourceToContentType(ressource),
            },
            body: fileToBody(fileLocation),
          }
        }

        if (cacheWithETag) {
          return getContentAndETag(fileLocation).then(({ content, eTag }) => {
            if ("if-none-match" in headers && headers["if-none-match"] === eTag) {
              return {
                status: 304,
                headers: {
                  ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
                },
              }
            }

            return {
              status: 200,
              headers: {
                ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
                "content-length": stat.size,
                "content-type": ressourceToContentType(ressource),
                etag: eTag,
              },
              body: content,
            }
          }, convertFileSystemErrorToResponseProperties)
        }

        return {
          status: 200,
          headers: {
            ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
            "content-length": stat.size,
            "content-type": ressourceToContentType(ressource),
          },
          body: fileToBody(fileLocation),
        }
      }, convertFileSystemErrorToResponseProperties)
  }
}
