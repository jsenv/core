import fs from "fs"
import { createETag } from "../compileToCompileFile/helpers.js"
import { convertFileSystemErrorToResponseProperties } from "./convertFileSystemErrorToResponseProperties.js"
import { ressourceToExtension } from "../urlHelper.js"

// https://github.com/restify/node-restify/blob/d4cb86591ccc45f005ff174d0ae887fd1dc6db9c/lib/response.js#L58
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const dateToUTC = (date) => {
  const pad = (val) => {
    if (parseInt(val, 10) < 10) val = `0 ${val}`
    return val
  }

  const UTCDay = DAYS[date.getUTCDay()]
  const UTCDate = pad(date.getUTCDate())
  const UTCMonth = MONTHS[date.getUTCMonth()]
  const UTCFullYear = date.getUTCFullYear()
  const UTCHours = pad(date.getUTCHours())
  const UTCMinutes = pad(date.getUTCMinutes())
  const UTCSeconds = pad(date.getUTCSeconds())

  return `${UTCDay}, ${UTCDate} ${UTCMonth} ${UTCFullYear} ${UTCHours}:${UTCMinutes}:${UTCSeconds} GMT`
}

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}

const mimetype = (ressource) => {
  const defaultMimetype = "application/octet-stream"

  const mimetypes = {
    // text
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    appcache: "text/cache-manifest",
    // application
    js: "application/javascript",
    json: "application/json",
    map: "application/json",
    xml: "application/xml",
    gz: "application/x-gzip",
    zip: "application/zip",
    pdf: "application/pdf",
    // image
    png: "image/png",
    gif: "image/gif",
    jpg: "image/jpeg",
    // audio
    mp3: "audio/mpeg",
  }

  const extension = ressourceToExtension(ressource)

  if (extension in mimetypes) {
    return mimetypes[extension]
  }

  return defaultMimetype
}

const stat = (location) => {
  return new Promise((resolve, reject) => {
    fs.stat(location, (error, stat) => {
      if (error) {
        reject(error)
      } else {
        resolve(stat)
      }
    })
  })
}

const readFile = (location) => {
  return new Promise((resolve, reject) => {
    fs.readFile(location, (error, buffer) => {
      if (error) {
        reject(error)
      } else {
        resolve(String(buffer))
      }
    })
  })
}

const listDirectoryContent = (location) => {
  return new Promise((resolve, reject) => {
    fs.readdir(location, (error, ressourceNames) => {
      if (error) {
        reject(error)
      } else {
        resolve(ressourceNames)
      }
    })
  })
}

export const createRequestToFileResponse = (
  {
    root,
    canReadDirectory = false,
    getFileStat = stat,
    getFileContentAsString = readFile,
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
              "last-modified": dateToUTC(stat.mtime),
              "content-length": stat.size,
              "content-type": mimetype(ressource),
            },
            body: fs.createReadStream(fileLocation),
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
                "content-type": mimetype(ressource),
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
            "content-type": mimetype(ressource),
          },
          body: fs.createReadStream(fileLocation),
        }
      }, convertFileSystemErrorToResponseProperties)
  }
}
