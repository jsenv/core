import { createHash } from "crypto"
import {
  resolveUrl,
  urlToParentUrl,
  urlToBasename,
  urlToExtension,
} from "@jsenv/filesystem"
import { renderNamePattern } from "../renderNamePattern.js"

export const computeBuildRelativeUrlForRessource = (
  ressource,
  {
    urlVersionningForEntryPoints,
    entryPointMap,
    workerUrls,
    asOriginalUrl,
    lineBreakNormalization,
  },
) => {
  const pattern = getFilenamePattern({
    ressource,
    urlVersionningForEntryPoints,
    entryPointMap,
    workerUrls,
    asOriginalUrl,
  })
  return computeBuildRelativeUrl(ressource.url, ressource.bufferAfterBuild, {
    pattern,
    contentType: ressource.contentType,
    lineBreakNormalization,
  })
}

const getFilenamePattern = ({
  ressource,
  urlVersionningForEntryPoints,
  entryPointMap,
  workerUrls,
  asOriginalUrl,
}) => {
  if (ressource.isEntryPoint) {
    const entryKey = Object.keys(entryPointMap).find((key) => {
      return key === `./${ressource.relativeUrl}`
    })
    if (entryKey) {
      const buildRelativeUrl = entryPointMap[entryKey]
      const name = urlToBasename(resolveUrl(buildRelativeUrl, "file:///"))
      return urlVersionningForEntryPoints
        ? `${name}-[hash][extname]`
        : `${name}[extname]`
    }
    return urlVersionningForEntryPoints
      ? "[name]-[hash][extname]"
      : "[name]-[extname]"
  }

  if (ressource.isJsModule) {
    const originalUrl = asOriginalUrl(ressource.url)

    // it's a module worker
    if (ressource.isWorker) {
      const workerBuildRelativeUrl = workerUrls[originalUrl]
      const workerBuildUrl = resolveUrl(workerBuildRelativeUrl, "file:///")
      const name = urlToBasename(workerBuildUrl)
      return `${name}-[hash][extname]`
    }

    // TODO: it's a module service worker

    // it's a js module
    return "[name]-[hash][extname]"
  }

  if (ressource.fileNamePattern) {
    return ressource.fileNamePattern
  }

  if (
    // service worker MUST be at the root (same level than the HTML file)
    // otherwise it might be registered for the scope "/assets/" instead of "/"
    // Also they must not be versioned
    ressource.isServiceWorker
  ) {
    return "[name][extname]"
  }

  return ressource.urlVersioningDisabled
    ? "assets/[name][extname]"
    : "assets/[name]-[hash][extname]"
}

const computeBuildRelativeUrl = (
  fileUrl,
  fileContent,
  {
    name = urlToBasename(fileUrl),
    pattern = "[name]-[hash][extname]",
    contentType = "application/octet-stream",
    lineBreakNormalization = false,
  } = {},
) => {
  const buildRelativeUrl = renderNamePattern(
    typeof pattern === "function" ? pattern() : pattern,
    {
      dirname: () => urlToParentUrl(fileUrl),
      name: () => name,
      hash: () =>
        generateContentHash(fileContent, {
          contentType,
          lineBreakNormalization,
        }),
      extname: () => urlToExtension(fileUrl),
    },
  )
  return buildRelativeUrl
}

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
export const generateContentHash = (
  stringOrBuffer,
  {
    contentType = "application/octet-stream",
    lineBreakNormalization = false,
  } = {},
) => {
  const hash = createHash("sha256")
  hash.update(
    lineBreakNormalization && contentTypeIsTextual(contentType)
      ? normalizeLineBreaks(stringOrBuffer)
      : stringOrBuffer,
  )
  return hash.digest("hex").slice(0, 8)
}

const contentTypeIsTextual = (contentType) => {
  if (contentType.startsWith("text/")) {
    return true
  }
  // catch things like application/manifest+json, application/importmap+json
  if (/^application\/\w+\+json$/.test(contentType)) {
    return true
  }
  if (CONTENT_TYPE_AS_TEXT.includes(contentType)) {
    return true
  }
  return false
}

const CONTENT_TYPE_AS_TEXT = [
  "application/javascript",
  "application/json",
  "image/svg+xml",
]

const normalizeLineBreaks = (stringOrBuffer) => {
  if (typeof stringOrBuffer === "string") {
    const stringWithLinuxBreaks = stringOrBuffer.replace(/\r\n/g, "\n")
    return stringWithLinuxBreaks
  }
  return normalizeLineBreaksForBuffer(stringOrBuffer)
}

// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const normalizeLineBreaksForBuffer = (buffer) => {
  const int32Array = new Int32Array(buffer, 0, buffer.length)
  const int32ArrayWithLineBreaksNormalized = int32Array.filter(
    (element, index, typedArray) => {
      if (element === 0x0d) {
        if (typedArray[index + 1] === 0x0a) {
          // Windows -> Unix
          return false
        }
        // Mac OS -> Unix
        typedArray[index] = 0x0a
      }
      return true
    },
  )
  return Buffer.from(int32ArrayWithLineBreaksNormalized)
}
