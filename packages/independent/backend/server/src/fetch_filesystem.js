/*
 * This function returns response properties in a plain object like
 * { status: 200, body: "Hello world" }.
 * It is meant to be used inside "requestToResponse"
 */

import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { createReadStream, readFile, statSync } from "node:fs";
import { pickContentEncoding } from "./content_negotiation/pick_content_encoding.js";
import { convertFileSystemErrorToResponseProperties } from "./internal/convertFileSystemErrorToResponseProperties.js";
import { bufferToEtag } from "./internal/etag.js";
import {
  fileSystemPathToUrl,
  isFileSystemPath,
} from "./internal/filesystem.js";
import { composeTwoResponses } from "./internal/response_composition.js";
import { serveDirectory } from "./serve_directory.js";
import { timeFunction } from "./server_timing/timing_measure.js";

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
    ENOENTFallback = () => {},
  } = {},
) => {
  const urlString = asUrlString(filesystemUrl);
  if (!urlString) {
    return create500Response(
      `fetchFileSystem first parameter must be a file url, got ${filesystemUrl}`,
    );
  }
  if (!urlString.startsWith("file://")) {
    return create500Response(
      `fetchFileSystem url must use "file://" scheme, got ${filesystemUrl}`,
    );
  }
  if (rootDirectoryUrl) {
    let rootDirectoryUrlString = asUrlString(rootDirectoryUrl);
    if (!rootDirectoryUrlString) {
      return create500Response(
        `rootDirectoryUrl must be a string or an url, got ${rootDirectoryUrl}`,
      );
    }
    if (!rootDirectoryUrlString.endsWith("/")) {
      rootDirectoryUrlString = `${rootDirectoryUrlString}/`;
    }
    if (!urlString.startsWith(rootDirectoryUrlString)) {
      return create500Response(
        `fetchFileSystem url must be inside root directory, got ${urlString}`,
      );
    }
    rootDirectoryUrl = rootDirectoryUrlString;
  }

  // here you might be tempted to add || cacheControl === 'no-cache'
  // but no-cache means resource can be cached but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability
  if (cacheControl === "no-store") {
    if (etagEnabled) {
      console.warn(`cannot enable etag when cache-control is ${cacheControl}`);
      etagEnabled = false;
    }
    if (mtimeEnabled) {
      console.warn(`cannot enable mtime when cache-control is ${cacheControl}`);
      mtimeEnabled = false;
    }
  }
  if (etagEnabled && mtimeEnabled) {
    console.warn(
      `cannot enable both etag and mtime, mtime disabled in favor of etag.`,
    );
    mtimeEnabled = false;
  }

  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501,
    };
  }

  const serveFile = async (fileUrl) => {
    try {
      const [readStatTiming, fileStat] = timeFunction(
        "file service>read file stat",
        () => statSync(new URL(fileUrl)),
      );
      if (fileStat.isDirectory()) {
        if (canReadDirectory) {
          return serveDirectory(fileUrl, {
            headers,
            canReadDirectory,
            rootDirectoryUrl,
          });
        }
        return {
          status: 403,
          statusText: "not allowed to read directory",
        };
      }
      // not a file, give up
      if (!fileStat.isFile()) {
        return {
          status: 404,
          timing: readStatTiming,
        };
      }

      const clientCacheResponse = await getClientCacheResponse({
        headers,
        etagEnabled,
        etagMemory,
        etagMemoryMaxSize,
        mtimeEnabled,
        fileStat,
        fileUrl,
      });

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
        );
      }

      let response;
      if (compressionEnabled && fileStat.size >= compressionSizeThreshold) {
        const compressedResponse = await getCompressedResponse({
          headers,
          fileUrl,
        });
        if (compressedResponse) {
          response = compressedResponse;
        }
      }
      if (!response) {
        response = await getRawResponse({
          fileStat,
          fileUrl,
        });
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
      );
      return composeTwoResponses(intermediateResponse, clientCacheResponse);
    } catch (e) {
      if (e.code === "ENOENT") {
        const fallbackFileUrl = ENOENTFallback();
        if (fallbackFileUrl) {
          return serveFile(fallbackFileUrl);
        }
      }
      return composeTwoResponses(
        {
          headers: {
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
          },
        },
        convertFileSystemErrorToResponseProperties(e) || {},
      );
    }
  };

  return serveFile(`file://${new URL(urlString).pathname}`);
};

const create500Response = (message) => {
  return {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(message),
    },
    body: message,
  };
};

const getClientCacheResponse = async ({
  headers,
  etagEnabled,
  etagMemory,
  etagMemoryMaxSize,
  mtimeEnabled,
  fileStat,
  fileUrl,
}) => {
  // here you might be tempted to add || headers["cache-control"] === "no-cache"
  // but no-cache means resource can be cache but must be revalidated (yeah naming is strange)
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Cacheability

  if (
    headers["cache-control"] === "no-store" ||
    // let's disable it on no-cache too
    headers["cache-control"] === "no-cache"
  ) {
    return { status: 200 };
  }

  if (etagEnabled) {
    return getEtagResponse({
      headers,
      etagMemory,
      etagMemoryMaxSize,
      fileStat,
      fileUrl,
    });
  }

  if (mtimeEnabled) {
    return getMtimeResponse({
      headers,
      fileStat,
    });
  }

  return { status: 200 };
};

const getEtagResponse = async ({
  headers,
  etagMemory,
  etagMemoryMaxSize,
  fileUrl,
  fileStat,
}) => {
  const [computeEtagTiming, fileContentEtag] = await timeFunction(
    "file service>generate file etag",
    () =>
      computeEtag({
        etagMemory,
        etagMemoryMaxSize,
        fileUrl,
        fileStat,
      }),
  );

  const requestHasIfNoneMatchHeader = "if-none-match" in headers;
  if (
    requestHasIfNoneMatchHeader &&
    headers["if-none-match"] === fileContentEtag
  ) {
    return {
      status: 304,
      timing: computeEtagTiming,
    };
  }

  return {
    status: 200,
    headers: {
      etag: fileContentEtag,
    },
    timing: computeEtagTiming,
  };
};

const ETAG_MEMORY_MAP = new Map();
const computeEtag = async ({
  etagMemory,
  etagMemoryMaxSize,
  fileUrl,
  fileStat,
}) => {
  if (etagMemory) {
    const etagMemoryEntry = ETAG_MEMORY_MAP.get(fileUrl);
    if (
      etagMemoryEntry &&
      fileStatAreTheSame(etagMemoryEntry.fileStat, fileStat)
    ) {
      return etagMemoryEntry.eTag;
    }
  }
  const fileContentAsBuffer = await new Promise((resolve, reject) => {
    readFile(new URL(fileUrl), (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
  const eTag = bufferToEtag(fileContentAsBuffer);
  if (etagMemory) {
    if (ETAG_MEMORY_MAP.size >= etagMemoryMaxSize) {
      const firstKey = Array.from(ETAG_MEMORY_MAP.keys())[0];
      ETAG_MEMORY_MAP.delete(firstKey);
    }
    ETAG_MEMORY_MAP.set(fileUrl, { fileStat, eTag });
  }
  return eTag;
};

// https://nodejs.org/api/fs.html#fs_class_fs_stats
const fileStatAreTheSame = (leftFileStat, rightFileStat) => {
  return fileStatKeysToCompare.every((keyToCompare) => {
    const leftValue = leftFileStat[keyToCompare];
    const rightValue = rightFileStat[keyToCompare];
    return leftValue === rightValue;
  });
};
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
];

const getMtimeResponse = async ({ headers, fileStat }) => {
  if ("if-modified-since" in headers) {
    let cachedModificationDate;
    try {
      cachedModificationDate = new Date(headers["if-modified-since"]);
    } catch {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date",
      };
    }

    const actualModificationDate = dateToSecondsPrecision(fileStat.mtime);
    if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
      return {
        status: 304,
      };
    }
  }

  return {
    status: 200,
    headers: {
      "last-modified": dateToUTCString(fileStat.mtime),
    },
  };
};

const getCompressedResponse = async ({ fileUrl, headers }) => {
  const contentType = CONTENT_TYPE.fromUrlExtension(fileUrl);
  if (CONTENT_TYPE.isBinary(contentType)) {
    return null;
  }
  const acceptedCompressionFormat = pickContentEncoding(
    { headers },
    Object.keys(availableCompressionFormats),
  );
  if (!acceptedCompressionFormat) {
    return null;
  }

  const fileReadableStream = fileUrlToReadableStream(fileUrl);
  const body =
    await availableCompressionFormats[acceptedCompressionFormat](
      fileReadableStream,
    );

  return {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-encoding": acceptedCompressionFormat,
      "vary": "accept-encoding",
    },
    body,
  };
};

const fileUrlToReadableStream = (fileUrl) => {
  return createReadStream(new URL(fileUrl), {
    emitClose: true,
    autoClose: true,
  });
};

const availableCompressionFormats = {
  br: async (fileReadableStream) => {
    const { createBrotliCompress } = await import("node:zlib");
    return fileReadableStream.pipe(createBrotliCompress());
  },
  deflate: async (fileReadableStream) => {
    const { createDeflate } = await import("node:zlib");
    return fileReadableStream.pipe(createDeflate());
  },
  gzip: async (fileReadableStream) => {
    const { createGzip } = await import("node:zlib");
    return fileReadableStream.pipe(createGzip());
  },
};

const getRawResponse = async ({ fileUrl, fileStat }) => {
  return {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE.fromUrlExtension(fileUrl),
      "content-length": fileStat.size,
    },
    body: fileUrlToReadableStream(fileUrl),
  };
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
const dateToUTCString = (date) => date.toUTCString();

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const asUrlString = (value) => {
  if (value instanceof URL) {
    return value.href;
  }
  if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      return fileSystemPathToUrl(value);
    }
    try {
      const urlObject = new URL(value);
      return String(urlObject);
    } catch {
      return null;
    }
  }
  return null;
};
