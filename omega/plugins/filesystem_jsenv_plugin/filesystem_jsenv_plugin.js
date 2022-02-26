// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/resolve.ts

import { realpathSync, statSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { urlIsInsideOf, urlToExtension } from "@jsenv/filesystem"

import { applyNodeEsmResolution } from "@jsenv/core/packages/node-esm-resolution"

import { resolveFile } from "./filesystem_resolution.js"

export const fileSystemJsenvPlugin = ({
  // importMap,
  magicExtensions = ["inherit"],
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  specifierResolution = "node_esm",
  packageConditions = ["import", "browser"],
} = {}) => {
  const applyFileSystemResolution = async ({ fileUrl, parentUrl }) => {
    const filesystemResolution = await resolveFile(fileUrl, {
      magicDirectoryIndexEnabled: true,
      magicExtensionEnabled: true,
      extensionsToTry: getExtensionsToTry(magicExtensions, parentUrl),
    })
    if (filesystemResolution.found) {
      return filesystemResolution.url
    }
    return null
  }

  return {
    name: "jsenv:filesystem",

    appliesDuring: {
      dev: true,
      test: true,
      build: true,
    },

    resolve: async ({
      projectDirectoryUrl,
      parentUrl,
      specifierType,
      specifier,
    }) => {
      const onUrl = async (url) => {
        // http, https, data, about, etc
        if (!url.startsWith("file:")) {
          return null
        }
        const resolved = await applyFileSystemResolution({
          fileUrl: url,
          parentUrl,
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
          return { url: realUrl, facade: url }
        }
        // if it's a bare specifier (not something like ../ or starting with file)
        // or /, then we'll use this bare specifier to refer to the ressource that is outside
        // the root directory
        if (
          !specifier.startsWith("../") &&
          !specifier.startsWith("file:") &&
          !specifier.startsWith("/")
        ) {
          return {
            url: realUrl,
            facade: specifier,
          }
        }
        throw new Error(
          "invalid ressource specifier: it is outside project directory",
        )
      }
      if (
        specifierType === "http_request" ||
        specifierType === "js_import_meta_url_pattern"
      ) {
        return onUrl(new URL(specifier, parentUrl).href)
      }
      if (
        specifierType === "js_import_export" &&
        specifierResolution === "node_esm"
      ) {
        const url = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
        })
        return onUrl(url)
      }
      return null
    },

    load: async ({ url, contentType }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      if (statSync(url).isDirectory()) {
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
