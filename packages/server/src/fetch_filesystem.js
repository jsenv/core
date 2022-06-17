/*
 * This function returns response properties in a plain object like
 * { status: 200, body: "Hello world" }.
 * It is meant to be used inside "requestToResponse"
 */

import { createReadStream, statSync, promises } from "node:fs"
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

import {
  isFileSystemPath,
  urlToFileSystemPath,
  fileSystemPathToUrl,
} from "@jsenv/server/src/internal/filesystem.js"
import { bufferToEtag } from "@jsenv/server/src/internal/etag.js"
import { composeTwoResponses } from "./internal/response_composition.js"
import { convertFileSystemErrorToResponseProperties } from "./internal/convertFileSystemErrorToResponseProperties.js"
import { timeFunction } from "./server_timing/timing_measure.js"
import { negotiateContentEncoding } from "./content_negotiation/negotiateContentEncoding.js"
import { serveDirectory } from "./serve_directory.js"

const ETAG_MEMORY_MAP = new Map()

export const fetchFileSystem = async (
  filesystemUrl,
  {
    // signal,
    method = "GET",
    headers = {},
    etagEnabled = false,
    etagMemory = true,
    etagMemoryMaxSize = 1000,
    mtimeEnabled = false,
    compressionEnabled = false,
    compressionSizeThreshold = 1024,
    cacheControl = etagEnabled || mtimeEnabled
      ? "private,max-age=0,must-revalidate"
      : "no-store",
    canReadDirectory = false,
    rootDirectoryUrl, //  = `${pathToFileURL(process.cwd())}/`,
  } = {},
) => {
  const urlString = asUrlString(filesystemUrl)
  if (!urlString) {
    return create500Response(
      `fetchFileSystem first parameter must be a file url, got ${filesystemUrl}`,
    )
  }
  if (!urlString.startsWith("file://")) {
    return create500Response(
      `fetchFileSystem url must use "file://" scheme, got ${filesystemUrl}`,
    )
  }
  if (rootDirectoryUrl) {
    let rootDirectoryUrlString = asUrlString(rootDirectoryUrl)
    if (!rootDirectoryUrlString) {
      return create500Response(
        `rootDirectoryUrl must be a string or an url, got ${rootDirectoryUrl}`,
      )
    }
    if (!rootDirectoryUrlString.endsWith("/")) {
      rootDirectoryUrlString = `${rootDirectoryUrlString}/`
    }
    if (!urlString.startsWith(rootDirectoryUrlString)) {
      return create500Response(
        `fetchFileSystem url must be inside root directory, got ${urlString}`,
      )
    }
    rootDirectoryUrl = rootDirectoryUrlString
  }

  // here you might be tempted to add || cacheControl === 'no-cache'
  // but no-cache means ressource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability
  if (cacheControl === "no-store") {
    if (etagEnabled) {
      console.warn(`cannot enable etag when cache-control is ${cacheControl}`)
      etagEnabled = false
    }
    if (mtimeEnabled) {
      console.warn(`cannot enable mtime when cache-control is ${cacheControl}`)
      mtimeEnabled = false
    }
  }
  if (etagEnabled && mtimeEnabled) {
    console.warn(
      `cannot enable both etag and mtime, mtime disabled in favor of etag.`,
    )
    mtimeEnabled = false
  }

  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    }
  }

  let sourceUrl = `file://${new URL(urlString).pathname}`
  const sourceFilesystemPath = urlToFileSystemPath(filesystemUrl)

  try {
    const [readStatTiming, sourceStat] = await timeFunction(
      "file service>read file stat",
      () => statSync(sourceFilesystemPath),
    )
    if (sourceStat.isDirectory()) {
      if (canReadDirectory) {
        return serveDirectory(urlString, {
          headers,
          canReadDirectory,
          rootDirectoryUrl,
        })
      }
      return {
        status: 403,
        statusText: "not allowed to read directory",
      }
    }
    // not a file, give up
    if (!sourceStat.isFile()) {
      return {
        status: 404,
        timing: readStatTiming,
      }
    }

    const clientCacheResponse = await getClientCacheResponse({
      headers,
      etagEnabled,
      etagMemory,
      etagMemoryMaxSize,
      mtimeEnabled,
      sourceStat,
      sourceUrl,
    })

    // send 304 (redirect response to client cache)
    // because the response body does not have to be transmitted
    if (clientCacheResponse.status === 304) {
      return composeTwoResponses(
        {
          timing: readStatTiming,
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
          },
        },
        clientCacheResponse,
      )
    }

    let response
    if (compressionEnabled && sourceStat.size >= compressionSizeThreshold) {
      const compressedResponse = await getCompressedResponse({
        headers,
        sourceUrl,
      })
      if (compressedResponse) {
        response = compressedResponse
      }
    }
    if (!response) {
      response = await getRawResponse({
        sourceStat,
        sourceUrl,
      })
    }

    const intermediateResponse = composeTwoResponses(
      {
        timing: readStatTiming,
        headers: {
          ...(cacheControl ? { "cache-control": cacheControl } : {}),
          // even if client cache is disabled, server can still
          // send his own cache control but client should just ignore it
          // and keep sending cache-control: 'no-store'
          // if not, uncomment the line below to preserve client
          // desire to ignore cache
          // ...(headers["cache-control"] === "no-store" ? { "cache-control": "no-store" } : {}),
        },
      },
      response,
    )
    return composeTwoResponses(intermediateResponse, clientCacheResponse)
  } catch (e) {
    return composeTwoResponses(
      {
        headers: {
          ...(cacheControl ? { "cache-control": cacheControl } : {}),
        },
      },
      convertFileSystemErrorToResponseProperties(e) || {},
    )
  }
}

const create500Response = (message) => {
  return {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(message),
    },
    body: message,
  }
}

const getClientCacheResponse = async ({
  headers,
  etagEnabled,
  etagMemory,
  etagMemoryMaxSize,
  mtimeEnabled,
  sourceStat,
  sourceUrl,
}) => {
  // here you might be tempted to add || headers["cache-control"] === "no-cache"
  // but no-cache means ressource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability

  if (
    headers["cache-control"] === "no-store" ||
    // let's disable it on no-cache too
    headers["cache-control"] === "no-cache"
  ) {
    return { status: 200 }
  }

  if (etagEnabled) {
    return getEtagResponse({
      headers,
      etagMemory,
      etagMemoryMaxSize,
      sourceStat,
      sourceUrl,
    })
  }

  if (mtimeEnabled) {
    return getMtimeResponse({
      headers,
      sourceStat,
    })
  }

  return { status: 200 }
}

const getEtagResponse = async ({
  headers,
  etagMemory,
  etagMemoryMaxSize,
  sourceUrl,
  sourceStat,
}) => {
  const [computeEtagTiming, fileContentEtag] = await timeFunction(
    "file service>generate file etag",
    () =>
      computeEtag({
        etagMemory,
        etagMemoryMaxSize,
        sourceUrl,
        sourceStat,
      }),
  )

  const requestHasIfNoneMatchHeader = "if-none-match" in headers
  if (
    requestHasIfNoneMatchHeader &&
    headers["if-none-match"] === fileContentEtag
  ) {
    return {
      status: 304,
      timing: computeEtagTiming,
    }
  }

  return {
    status: 200,
    headers: {
      etag: fileContentEtag,
    },
    timing: computeEtagTiming,
  }
}

const computeEtag = async ({
  etagMemory,
  etagMemoryMaxSize,
  sourceUrl,
  sourceStat,
}) => {
  if (etagMemory) {
    const etagMemoryEntry = ETAG_MEMORY_MAP.get(sourceUrl)
    if (
      etagMemoryEntry &&
      fileStatAreTheSame(etagMemoryEntry.sourceStat, sourceStat)
    ) {
      return etagMemoryEntry.eTag
    }
  }
  const fileContentAsBuffer = await promises.readFile(
    urlToFileSystemPath(sourceUrl),
  )
  const eTag = bufferToEtag(fileContentAsBuffer)
  if (etagMemory) {
    if (ETAG_MEMORY_MAP.size >= etagMemoryMaxSize) {
      const firstKey = Array.from(ETAG_MEMORY_MAP.keys())[0]
      ETAG_MEMORY_MAP.delete(firstKey)
    }
    ETAG_MEMORY_MAP.set(sourceUrl, { sourceStat, eTag })
  }
  return eTag
}

// https://nodejs.org/api/fs.html#fs_class_fs_stats
const fileStatAreTheSame = (leftFileStat, rightFileStat) => {
  return fileStatKeysToCompare.every((keyToCompare) => {
    const leftValue = leftFileStat[keyToCompare]
    const rightValue = rightFileStat[keyToCompare]
    return leftValue === rightValue
  })
}
const fileStatKeysToCompare = [
  // mtime the the most likely to change, check it first
  "mtimeMs",
  "size",
  "ctimeMs",
  "ino",
  "mode",
  "uid",
  "gid",
  "blksize",
]

const getMtimeResponse = async ({ headers, sourceStat }) => {
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

    const actualModificationDate = dateToSecondsPrecision(sourceStat.mtime)
    if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
      return {
        status: 304,
      }
    }
  }

  return {
    status: 200,
    headers: {
      "last-modified": dateToUTCString(sourceStat.mtime),
    },
  }
}

const getCompressedResponse = async ({ sourceUrl, headers }) => {
  const acceptedCompressionFormat = negotiateContentEncoding(
    { headers },
    Object.keys(availableCompressionFormats),
  )
  if (!acceptedCompressionFormat) {
    return null
  }

  const fileReadableStream = fileUrlToReadableStream(sourceUrl)
  const body = await availableCompressionFormats[acceptedCompressionFormat](
    fileReadableStream,
  )

  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(sourceUrl),
      "content-encoding": acceptedCompressionFormat,
      "vary": "accept-encoding",
    },
    body,
  }
}

const fileUrlToReadableStream = (fileUrl) => {
  return createReadStream(urlToFileSystemPath(fileUrl), { emitClose: true })
}

const availableCompressionFormats = {
  br: async (fileReadableStream) => {
    const { createBrotliCompress } = await import("zlib")
    return fileReadableStream.pipe(createBrotliCompress())
  },
  deflate: async (fileReadableStream) => {
    const { createDeflate } = await import("zlib")
    return fileReadableStream.pipe(createDeflate())
  },
  gzip: async (fileReadableStream) => {
    const { createGzip } = await import("zlib")
    return fileReadableStream.pipe(createGzip())
  },
}

const getRawResponse = async ({ sourceUrl, sourceStat }) => {
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(sourceUrl),
      "content-length": sourceStat.size,
    },
    body: fileUrlToReadableStream(sourceUrl),
  }
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString()

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}

const asUrlString = (value) => {
  if (value instanceof URL) {
    return value.href
  }
  if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      return fileSystemPathToUrl(value)
    }
    try {
      const urlObject = new URL(value)
      return String(urlObject)
    } catch (e) {
      return null
    }
  }
  return null
}
