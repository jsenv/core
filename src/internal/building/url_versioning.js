import { createHash } from "crypto"
import {
  resolveUrl,
  urlToParentUrl,
  urlToBasename,
  urlToExtension,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { renderNamePattern } from "../renderNamePattern.js"

export const createUrlVersioner = ({
  urlVersionningForEntryPoints,
  entryPointMap,
  workerUrls,
  classicWorkerUrls,
  asOriginalUrl,
  lineBreakNormalization,
}) => {
  const computeBuildRelativeUrl = (ressource) => {
    const pattern = getFilenamePattern({
      ressource,
      urlVersionningForEntryPoints,
      entryPointMap,
      workerUrls,
      classicWorkerUrls,
      asOriginalUrl,
      precomputeBuildRelativeUrl,
    })
    return generateBuildRelativeUrl(ressource.url, ressource.bufferAfterBuild, {
      pattern,
      contentType: ressource.contentType,
      lineBreakNormalization,
    })
  }

  const precomputeBuildRelativeUrl = (ressource, bufferAfterBuild = "") => {
    if (ressource.buildRelativeUrl) {
      return ressource.buildRelativeUrl
    }

    ressource.bufferAfterBuild = bufferAfterBuild
    const precomputedBuildRelativeUrl = computeBuildRelativeUrl(ressource)
    ressource.bufferAfterBuild = undefined
    return precomputedBuildRelativeUrl
  }

  return {
    computeBuildRelativeUrl,
    precomputeBuildRelativeUrl,
  }
}

const getFilenamePattern = ({
  ressource,
  urlVersionningForEntryPoints,
  entryPointMap,
  workerUrls,
  classicWorkerUrls,
  asOriginalUrl,
  precomputeBuildRelativeUrl,
}) => {
  if (ressource.isEntryPoint) {
    const entryKey = Object.keys(entryPointMap).find((key) => {
      return key === `./${ressource.relativeUrl}`
    })
    if (entryKey) {
      const buildRelativeUrl = entryPointMap[entryKey]
      const patternStart = asPatternStart(buildRelativeUrl)
      return urlVersionningForEntryPoints
        ? `${patternStart}-[hash][extname]`
        : `${patternStart}[extname]`
    }
    return urlVersionningForEntryPoints
      ? "[name]-[hash][extname]"
      : "[name]-[extname]"
  }

  // service worker:
  // - MUST be at the root (same level than the HTML file)
  //   otherwise it might be registered for the scope "/assets/" instead of "/"
  // - MUST not be versioned
  if (ressource.isServiceWorker) {
    return "[name][extname]"
  }

  // it's a module worker
  if (ressource.isWorker) {
    const originalUrl = asOriginalUrl(ressource.url)
    const workerBuildRelativeUrl = ressource.isJsModule
      ? workerUrls[originalUrl]
      : classicWorkerUrls[originalUrl]
    const patternStart = asPatternStart(workerBuildRelativeUrl)
    return `${patternStart}-[hash][extname]`
  }

  // inline ressource inherits location
  if (ressource.isInline) {
    // inherit parent directory location because it's an inline file
    const importerBuildRelativeUrl = precomputeBuildRelativeUrl(
      ressource.importer,
    )
    const patternStart = asPatternStart(importerBuildRelativeUrl)
    return `${patternStart}-[hash][extname]`
  }

  // importmap.
  // we want to force the fileName for the importmap
  // so that we don't have to rewrite its content
  // the goal is to put the importmap at the same relative path
  // than in the project
  if (ressource.contentType === "application/importmap+json") {
    const importmapImporterUrl = ressource.importer.url
    const importmapRessourceUrl = ressource.url
    const importmapUrlRelativeToImporter = urlToRelativeUrl(
      importmapRessourceUrl,
      importmapImporterUrl,
    )
    const patternStart = asPatternStart(importmapUrlRelativeToImporter)
    return `${patternStart}-[hash][extname]`
  }

  if (ressource.isJsModule) {
    // it's a js module
    return "[name]-[hash][extname]"
  }

  return ressource.urlVersioningDisabled
    ? "assets/[name][extname]"
    : "assets/[name]-[hash][extname]"
}

const asPatternStart = (buildRelativeUrl) => {
  const buildUrl = resolveUrl(buildRelativeUrl, "file://")
  const parentUrl = urlToParentUrl(buildUrl)
  const parentRelativeUrl = urlToRelativeUrl(parentUrl, "file://")
  const basename = urlToBasename(buildUrl)
  return `${parentRelativeUrl}${basename}`
}

const generateBuildRelativeUrl = (
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
