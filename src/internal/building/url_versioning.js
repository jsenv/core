import { createHash } from "crypto"
import {
  urlToParentUrl,
  urlToBasename,
  urlToExtension,
} from "@jsenv/filesystem"

export const createUrlVersioner = ({
  entryPointUrls,
  asOriginalUrl,
  lineBreakNormalization,
}) => {
  const names = []
  const getFreeName = (name) => {
    let nameCandidate = name
    let integer = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate)
        return nameCandidate
      }
      integer++
      nameCandidate = `${name}${integer}`
    }
  }

  const computeBuildRelativeUrl = (ressource, precomputation) => {
    const pattern = getFilenamePattern({
      ressource,
      entryPointUrls,
      asOriginalUrl,
      precomputeBuildRelativeUrl,
    })

    const buildRelativeUrl = generateBuildRelativeUrl(
      ressource.url,
      ressource.bufferAfterBuild,
      {
        pattern,
        getName: precomputation
          ? () => urlToBasename(ressource.url)
          : () => getFreeName(urlToBasename(ressource.url)),
        contentType: ressource.contentType,
        lineBreakNormalization,
      },
    )
    return buildRelativeUrl
  }

  const precomputeBuildRelativeUrl = (ressource, bufferAfterBuild = "") => {
    if (ressource.buildRelativeUrl) {
      return ressource.buildRelativeUrl
    }
    if (ressource.precomputedBuildRelativeUrl) {
      return ressource.precomputedBuildRelativeUrl
    }

    ressource.bufferAfterBuild = bufferAfterBuild
    const precomputedBuildRelativeUrl = computeBuildRelativeUrl(ressource, true)
    ressource.bufferAfterBuild = undefined
    ressource.precomputedBuildRelativeUrl = precomputedBuildRelativeUrl
    return precomputedBuildRelativeUrl
  }

  return {
    computeBuildRelativeUrl,
    precomputeBuildRelativeUrl,
  }
}

const getFilenamePattern = ({
  ressource,
  entryPointUrls,
  asOriginalUrl,
  precomputeBuildRelativeUrl,
}) => {
  if (ressource.isEntryPoint) {
    const originalUrl = asOriginalUrl(ressource.url)
    const entryPointBuildRelativeUrl = entryPointUrls[originalUrl]
    return entryPointBuildRelativeUrl
  }

  // inline ressource inherits location
  if (ressource.isInline) {
    // inherit parent directory location because it's an inline file
    const importerBuildRelativeUrl = precomputeBuildRelativeUrl(
      ressource.importer,
    )
    const name = urlToBasename(`file://${importerBuildRelativeUrl}`)
    return `${name}_[hash][extname]`
  }

  // importmap.
  // we want to force the fileName for the importmap
  // so that we don't have to rewrite its content
  // the goal is to put the importmap at the same relative path
  // than in the project
  if (ressource.contentType === "application/importmap+json") {
    const importmapRessourceUrl = ressource.url
    const name = urlToBasename(importmapRessourceUrl)
    return `${name}_[hash][extname]`
  }

  // service worker:
  // - MUST be at the root (same level than the HTML file)
  //   otherwise it might be registered for the scope "/assets/" instead of "/"
  // - MUST not be versioned
  if (ressource.isServiceWorker) {
    return "[name][extname]"
  }

  if (ressource.isWorker) {
    return "[name]_[hash][extname]"
  }

  if (ressource.isJsModule) {
    return "[name]_[hash][extname]"
  }

  return ressource.urlVersioningDisabled
    ? "assets/[name][extname]"
    : "assets/[name]_[hash][extname]"
}

const generateBuildRelativeUrl = (
  fileUrl,
  fileContent,
  {
    getName,
    pattern,
    contentType = "application/octet-stream",
    lineBreakNormalization = false,
  } = {},
) => {
  pattern = typeof pattern === "function" ? pattern() : pattern
  if (pattern.startsWith("./")) pattern = pattern.slice(2)
  const buildRelativeUrl = renderFileNamePattern(pattern, {
    dirname: () => urlToParentUrl(fileUrl),
    name: getName,
    hash: () =>
      generateContentHash(fileContent, {
        contentType,
        lineBreakNormalization,
      }),
    extname: () => urlToExtension(fileUrl),
  })
  return buildRelativeUrl
}

const renderFileNamePattern = (pattern, replacements) => {
  return pattern.replace(/\[(\w+)\]/g, (_match, type) => {
    const replacement = replacements[type]()
    return replacement
  })
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
