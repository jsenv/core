import fs from "fs"
import os from "os"
import path from "path"
import { URL } from "url"
import { createETag } from "../createCompileService/helpers.js"
import { convertFileSystemErrorToResponseProperties } from "./convertFileSystemErrorToResponseProperties.js"

const mimetype = (pathname) => {
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

  const suffix = path.extname(pathname).slice(1)
  if (suffix in mimetypes) {
    return mimetypes[suffix]
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

export const createFileService = (
  { canReadDirectory = false, getFileStat = stat, getFileContentAsString = readFile } = {},
) => ({ method, url, headers }) => {
  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    }
  }

  const fileURL = new URL(url)
  // since https://github.com/nodejs/node/pull/10739
  // fs methods supports url as path
  // otherwise keep in mind that
  // new URL('file:///path/to/file.js').pathname returns 'path/to/file.js' on MAC
  // new URL('file:///C:/path/to/file.js').pathname returns '/C:/path/to/file.js' on WINDOWS
  // in order words you have to remove the leading '/' on windows
  // it does not work let's go path removing leading '/' on windows
  // const fileLocation = fileURL.toString()
  const fileLocation = os.platform() === "win32" ? fileURL.pathname.slice(1) : fileURL.pathname

  return Promise.resolve()
    .then(() => getFileStat(fileLocation))
    .then((stat) => {
      if (stat.isDirectory()) {
        if (canReadDirectory === false) {
          return {
            status: 403,
            reason: "not allowed to read directory",
            headers: {
              "cache-control": "no-store",
              "last-modified": stat.mtime.toUTCString(),
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
                "cache-control": "no-store",
                "content-type": "application/json",
                "content-length": directoryListAsJSON.length,
              },
              body: directoryListAsJSON,
            }
          })
      }

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

        const actualModificationDate = stat.mtime
        if (Number(cachedModificationDate) < Number(actualModificationDate)) {
          return {
            status: 304,
            headers: {
              "cache-control": "no-store",
            },
          }
        }
      }

      if ("if-none-match" in headers) {
        const cachedETag = headers["if-none-match"]
        return Promise.resolve()
          .then(() => getFileContentAsString(fileLocation))
          .then((content) => {
            const eTag = createETag(content)
            if (cachedETag === eTag) {
              return {
                status: 304,
                headers: {
                  "cache-control": "no-store",
                },
              }
            }
            return {
              status: 200,
              headers: {
                "cache-control": "no-store",
                "content-length": stat.size,
                "content-type": mimetype(url.pathname),
                ETag: eTag,
              },
              body: content,
            }
          }, convertFileSystemErrorToResponseProperties)
      }

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-length": stat.size,
          "content-type": mimetype(url.pathname),
        },
        body: fs.createReadStream(fileLocation),
      }
    }, convertFileSystemErrorToResponseProperties)
}
