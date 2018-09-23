import fs from "fs"
import os from "os"
import path from "path"
import { URL } from "url"
import { createETag } from "../createCompileService/helpers.js"

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

const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code
}

export const convertFileSystemErrorToResponseProperties = (error) => {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      reason: "no permission to read file",
    }
  }

  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      reason: "no permission to read file",
    }
  }

  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      reason: "file not found",
    }
  }

  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      reason: "file is busy",
      headers: {
        "retry-after": 0.01, // retry in 10ms
      },
    }
  }

  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      reason: "too many file opened",
      headers: {
        "retry-after": 0.1, // retry in 100ms
      },
    }
  }

  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      reason: "Unexpected directory operation",
    }
  }

  return {
    status: 500,
    reason: "unknown file system error",
  }
}

const stat = (location) => {
  return new Promise((resolve, reject) => {
    fs.stat(location, (error, stat) => {
      if (error) {
        reject(convertFileSystemErrorToResponseProperties(error))
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
        reject(convertFileSystemErrorToResponseProperties(error))
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
  { include = () => true, locate = ({ url }) => url, canReadDirectory = false } = {},
) => ({ method, url, headers: requestHeaders }) => {
  if (!include(url)) {
    return false
  }

  let status
  let reason
  const headers = {}
  let body

  headers["cache-control"] = "no-store"

  let promise

  if (method === "GET" || method === "HEAD") {
    promise = Promise.resolve(locate({ method, url })).then((fileURL) => {
      fileURL = new URL(fileURL)
      // since https://github.com/nodejs/node/pull/10739
      // fs methods supports url as path
      // otherwise keep in mind that
      // new URL('file:///path/to/file.js').pathname returns 'path/to/file.js' on MAC
      // new URL('file:///C:/path/to/file.js').pathname returns '/C:/path/to/file.js' on WINDOWS
      // in order words you have to remove the leading '/' on windows
      // it does not work let's go path removing leading '/' on windows
      // const fileLocation = fileURL.toString()
      const fileLocation = os.platform() === "win32" ? fileURL.pathname.slice(1) : fileURL.pathname

      let cachedModificationDate
      if (requestHeaders.has("if-modified-since")) {
        try {
          cachedModificationDate = new Date(requestHeaders.get("if-modified-since"))
        } catch (e) {
          status = 400
          reason = "if-modified-since header is not a valid date"
          return {
            status,
            reason,
            headers,
            body,
          }
        }
      }

      return stat(fileLocation).then(
        (stat) => {
          const actualModificationDate = stat.mtime

          headers["last-modified"] = actualModificationDate.toUTCString()

          if (stat.isDirectory()) {
            if (canReadDirectory === false) {
              status = 403
              reason = "not allowed to read directory"
              return
            }

            return listDirectoryContent(fileLocation)
              .then(JSON.stringify)
              .then((directoryListAsJSON) => {
                status = 200
                headers["content-type"] = "application/json"
                headers["content-length"] = directoryListAsJSON.length
                body = directoryListAsJSON
              })
          }

          if (
            cachedModificationDate &&
            Number(cachedModificationDate) < Number(actualModificationDate)
          ) {
            status = 304
            return
          }

          headers["content-length"] = stat.size

          const cachedETag = requestHeaders.get("if-none-match")
          if (cachedETag) {
            return readFile(fileLocation).then((content) => {
              const eTag = createETag(content)
              if (cachedETag === eTag) {
                status = 304
              } else {
                status = 200
                headers["content-type"] = mimetype(url.pathname)
                headers.ETag = eTag
                body = content
              }
            })
          }

          status = 200
          headers["content-type"] = mimetype(url.pathname)
          body = fs.createReadStream(fileLocation)
        },
        ({
          status: responseStatus,
          reason: responseReason,
          headers: responseHeaders = {},
          body: responseBody,
        }) => {
          status = responseStatus
          reason = responseReason
          Object.assign(headers, responseHeaders)
          body = responseBody
          return Promise.resolve()
        },
      )
    })
  } else {
    status = 501
    promise = Promise.resolve()
  }

  return promise.then(() => {
    return {
      status,
      reason,
      headers,
      body,
    }
  })
}
