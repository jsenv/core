// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/resolve.ts

import { realpathSync, statsSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { urlIsInsideOf, urlToExtension } from "@jsenv/filesystem"

import { applyNodeEsmResolution } from "@jsenv/core/packages/jsenv-node-esm-resolution"

import { resolveFile } from "./filesystem_resolution.js"

export const fileSystemJsenvPlugin = ({
  // importMap,
  magicExtensions = ["inherit"],
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  specifierResolution = "node_esm",
  packageConditions = ["import", "browser"],
} = {}) => {
  const applyFileSystemResolution = async ({ fileUrl, baseUrl }) => {
    const filesystemResolution = await resolveFile(fileUrl, {
      magicDirectoryIndexEnabled: true,
      magicExtensionEnabled: true,
      extensionsToTry: getExtensionsToTry(magicExtensions, baseUrl),
    })
    if (filesystemResolution.found) {
      return filesystemResolution.url
    }
    return null
  }

  return {
    name: "jsenv:filesystem",

    shouldSkip: ({ runtimeName }) => {
      return runtimeName === "node"
    },

    resolve: async ({
      projectDirectoryUrl,
      urlSpecifier,
      baseUrl,
      type = "url",
    }) => {
      const onUrl = async (url) => {
        // http, https, data, about, etc
        if (url.startsWith("file:")) {
          return url
        }
        const resolved = await applyFileSystemResolution({
          fileUrl: url,
          baseUrl,
        })
        if (!resolved) {
          return null
        }
        const urlObject = new URL(url)
        const { search, hash } = urlObject
        // urlObject.search = ""
        // urlObject.hash = ""
        const realPath = realpathSync(urlObject)
        const realFileUrl = pathToFileURL(realPath)
        const realUrl = `${realFileUrl}${search}${hash}`
        if (urlIsInsideOf(realUrl, projectDirectoryUrl)) {
          return realUrl
        }
        if (realUrl !== url && urlIsInsideOf(url, projectDirectoryUrl)) {
          // when symlink is inside root directory use it as facadeurl
          return { url: realUrl, urlFacade: url }
        }
        // if it's a bare specifier (not something like ../ or starting with file)
        // or /, then we'll use this bare specifier to refer to the ressource that is outside
        // the root directory
        if (
          !urlSpecifier.startsWith("../") &&
          !urlSpecifier.startsWith("file:") &&
          !urlSpecifier.startsWith("/")
        ) {
          return {
            url: realUrl,
            urlFacade: urlSpecifier,
          }
        }
        throw new Error(
          "invalid ressource specifier: it is outside project directory",
        )
      }
      if (type === "url") {
        return onUrl(new URL(urlSpecifier, baseUrl).href)
      }
      if (specifierResolution === "node_esm") {
        const url = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl: baseUrl,
          specifier: urlSpecifier,
        })
        return onUrl(url)
      }
      return onUrl(new URL(urlSpecifier, baseUrl).href)
    },

    load: async ({ url, contentType }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      if (statsSync(url).isDirectory()) {
        throw new Error("Unsupported directory import")
      }
      const fileBuffer = readFileSync(new URL(url))
      if (contentTypeIsTextual(contentType)) {
        return {
          content: String(fileBuffer),
        }
      }
      return {
        content: fileBuffer,
      }
    },
  }
}

const getExtensionsToTry = (magicExtensions, importer) => {
  const extensionsSet = new Set()
  magicExtensions.forEach((magicExtension) => {
    if (magicExtension === "inherit") {
      const importerExtension = urlToExtension(importer)
      extensionsSet.add(importerExtension)
    } else {
      extensionsSet.add(magicExtension)
    }
  })
  return Array.from(extensionsSet.values())
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
