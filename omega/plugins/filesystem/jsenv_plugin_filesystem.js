// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/resolve.ts

import { realpathSync, statSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { urlIsInsideOf, urlToExtension } from "@jsenv/filesystem"

import {
  applyNodeEsmResolution,
  lookupPackageScope,
  readPackageJson,
  applyFileSystemMagicResolution,
} from "@jsenv/core/packages/node-esm-resolution/main.js"

export const jsenvPluginFileSystem = ({
  // importMap,
  magicExtensions = ["inherit"],
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  specifierResolution = "node_esm",
  packageConditions = ["import", "browser"],
} = {}) => {
  const applyFileSystemResolution = ({ fileUrl, parentUrl }) => {
    const filesystemResolution = applyFileSystemMagicResolution(fileUrl, {
      magicDirectoryIndex: false,
      magicExtensions: getExtensionsToTry(magicExtensions, parentUrl),
    })
    if (filesystemResolution.found) {
      return filesystemResolution.url
    }
    return null
  }
  const urlResolver = ({ projectDirectoryUrl, parentUrl, specifier }) => {
    if (specifier[0] === "/") {
      return {
        url: new URL(specifier.slice(1), projectDirectoryUrl).href,
      }
    }
    return {
      url: new URL(specifier, parentUrl).href,
    }
  }
  const nodeEsmResolver = ({ projectDirectoryUrl, parentUrl, specifier }) => {
    if (specifier[0] === "/") {
      return {
        url: new URL(specifier.slice(1), projectDirectoryUrl).href,
      }
    }
    return applyNodeEsmResolution({
      conditions: packageConditions,
      parentUrl,
      specifier,
    })
  }
  const specifierResolvers = {
    "http_request": urlResolver,
    "link_href": urlResolver,
    "script_src": urlResolver,
    "a_href": urlResolver,
    "iframe_src": urlResolver,
    "img_src": urlResolver,
    "img_srcset": urlResolver,
    "source_src": urlResolver,
    "source_srcset": urlResolver,
    "image_href": urlResolver,
    "use_href": urlResolver,
    "css_@import": urlResolver,
    "css_url": urlResolver,
    "js_import_export":
      specifierResolution === "node_esm" ? nodeEsmResolver : urlResolver,
    "js_import_meta_url_pattern": urlResolver,
  }

  return {
    name: "jsenv:filesystem",

    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      build: true,
    },

    resolve: async ({
      projectDirectoryUrl,
      parentUrl,
      specifierType,
      specifier,
    }) => {
      const specifierResolver = specifierResolvers[specifierType]
      if (!specifierResolver) {
        return null
      }
      const { url } = specifierResolver({
        projectDirectoryUrl,
        parentUrl,
        specifier,
      })
      // http, https, data, about, etc
      if (!url.startsWith("file:")) {
        return null
      }
      const resolved = applyFileSystemResolution({
        fileUrl: url,
        parentUrl,
      })
      if (!resolved) {
        return null
      }
      const packageUrl = lookupPackageScope(resolved)
      const urlVersion =
        packageUrl && packageUrl !== projectDirectoryUrl
          ? readPackageJson(packageUrl).version
          : undefined
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
        return {
          url: realUrl,
          urlFacade: url,
          urlVersion,
        }
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
          urlFacade: specifier,
          urlVersion,
        }
      }
      throw new Error(
        "invalid ressource specifier: it is outside project directory",
      )
    },

    load: async ({ url, contentType }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      const urlObject = new URL(url)
      if (statSync(urlObject).isDirectory()) {
        throw new Error("Unsupported directory import")
      }
      const fileBuffer = readFileSync(urlObject)
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
