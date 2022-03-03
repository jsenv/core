// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/resolve.ts

import { realpathSync, statSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { urlIsInsideOf, urlToExtension } from "@jsenv/filesystem"

import { filesystemRootUrl } from "#omega/internal/url_utils.js"
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
    const { url } = applyNodeEsmResolution({
      conditions: packageConditions,
      parentUrl,
      specifier,
    })
    return {
      url,
    }
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
    "css_sourcemap_comment": urlResolver,
    "css_@import": urlResolver,
    "css_url": urlResolver,
    "js_sourcemap_comment": urlResolver,
    "js_import_export":
      specifierResolution === "node_esm" ? nodeEsmResolver : urlResolver,
    "js_import_meta_url_pattern": urlResolver,
  }

  return {
    name: "jsenv:filesystem",
    appliesDuring: "*",
    resolve: async ({
      projectDirectoryUrl,
      parentUrl,
      specifierType,
      specifier,
    }) => {
      if (specifier.startsWith("/@fs/")) {
        const url = new URL(specifier.slice("/@fs".length), projectDirectoryUrl)
          .href
        return {
          url,
          urlFacade: `${projectDirectoryUrl}${specifier.slice(1)}`,
        }
      }
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
      let fileUrl = url
      fileUrl = applyFileSystemResolution({
        fileUrl,
        parentUrl,
      })
      if (!fileUrl) {
        return null
      }
      const packageUrl = lookupPackageScope(fileUrl)
      const urlVersion =
        packageUrl && packageUrl !== projectDirectoryUrl
          ? readPackageJson(packageUrl).version
          : undefined
      const urlObject = new URL(url)
      const { search, hash } = urlObject
      const realPath = realpathSync(new URL(fileUrl))
      const realFileUrl = `${pathToFileURL(realPath)}${search}${hash}`
      if (urlIsInsideOf(realFileUrl, projectDirectoryUrl)) {
        return realFileUrl
      }
      if (
        realFileUrl !== fileUrl &&
        urlIsInsideOf(fileUrl, projectDirectoryUrl)
      ) {
        // when symlink is inside root directory use it as facadeurl
        return {
          url: realFileUrl,
          urlFacade: fileUrl,
          urlVersion,
        }
      }
      return {
        url: realFileUrl,
        urlFacade: `${projectDirectoryUrl}@fs/${realFileUrl.slice(
          filesystemRootUrl.length,
        )}`,
        urlVersion,
      }
    },
    load: async ({ url, contentType }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      if (url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
        }
      }
      const urlObject = new URL(url)
      if (statSync(urlObject).isDirectory()) {
        return {
          response: {
            status: 403,
            statusText: "Not allowed to ready directory",
          },
        }
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
