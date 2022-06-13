import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs"
import { pathToFileURL } from "node:url"
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToExtension,
} from "@jsenv/filesystem"

import { applyFileSystemMagicResolution } from "@jsenv/node-esm-resolution"
import { ensurePathnameTrailingSlash } from "@jsenv/utils/urls/url_utils.js"
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const jsenvPluginFileUrls = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preservesSymlink = true,
  directoryReferenceAllowed = false,
}) => {
  return [
    jsenvFileUrlResolution({
      magicExtensions,
      magicDirectoryIndex,
      preservesSymlink,
    }),
    {
      name: "jsenv:filesystem_resolution",
      appliesDuring: "*",
      resolveUrl: {
        filesystem: (reference, context) => {
          const { parentUrl } = reference
          const parentUrlInfo = context.urlGraph.getUrlInfo(parentUrl)
          const baseUrl =
            parentUrlInfo && parentUrlInfo.type === "directory"
              ? ensurePathnameTrailingSlash(parentUrl)
              : parentUrl
          return new URL(reference.specifier, baseUrl).href
        },
      },
    },
    {
      name: "jsenv:@fs_resolution",
      appliesDuring: {
        // during dev and test it's a browser running the code
        // so absolute file urls needs to be relativized
        dev: true,
        test: true,
        // during build it's fine to use file:// urls
        build: false,
      },
      resolveUrl: (reference) => {
        if (reference.specifier.startsWith("/@fs/")) {
          const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length)
          return `file:///${fsRootRelativeUrl}`
        }
        return null
      },
      formatUrl: (reference, context) => {
        if (!reference.generatedUrl.startsWith("file:")) {
          return null
        }
        if (urlIsInsideOf(reference.generatedUrl, context.rootDirectoryUrl)) {
          return `/${urlToRelativeUrl(
            reference.generatedUrl,
            context.rootDirectoryUrl,
          )}`
        }
        return `/@fs/${reference.generatedUrl.slice("file:///".length)}`
      },
    },
    {
      name: "jsenv:file_url_fetching",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo, context) => {
        if (!urlInfo.url.startsWith("file:")) {
          return null
        }
        const urlObject = new URL(urlInfo.url)
        try {
          const fileBuffer = readFileSync(urlObject)
          const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url)
          if (CONTENT_TYPE.isTextual(contentType)) {
            return {
              contentType,
              content: String(fileBuffer),
            }
          }
          return {
            contentType,
            content: fileBuffer,
          }
        } catch (e) {
          if (e.code === "EISDIR" && directoryReferenceAllowed) {
            const directoryEntries = readdirSync(new URL(urlInfo.url))
            return {
              type: "directory",
              contentType: "application/json",
              content: JSON.stringify(directoryEntries, null, "  "),
              filename: urlToRelativeUrl(
                ensurePathnameTrailingSlash(urlInfo.url),
                context.rootDirectoryUrl,
              ),
            }
          }
          throw e
        }
      },
    },
  ]
}

const jsenvFileUrlResolution = ({
  magicExtensions,
  magicDirectoryIndex,
  preservesSymlink,
}) => {
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

  return {
    name: "jsenv:file_url_resolution",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null
      }
      const urlObject = new URL(reference.url)
      let stat
      try {
        stat = statSync(urlObject)
      } catch (e) {
        if (e.code === "ENOENT") {
          return null
        }
        throw e
      }
      const { search, hash } = urlObject
      const pathnameUsesTrailingSlash = urlObject.pathname.endsWith("/")
      urlObject.search = ""
      urlObject.hash = ""
      // force trailing slash on directories and remove eventual trailing slash on files
      if (stat.isDirectory() && !pathnameUsesTrailingSlash) {
        urlObject.pathname = `${urlObject.pathname}/`
      } else if (pathnameUsesTrailingSlash) {
        // a warning would be great because it's strange to do that
        urlObject.pathname = urlObject.pathname.slice(0, -1)
      }
      const filesystemResolution = applyFileSystemMagicResolution(
        urlObject.href,
        {
          fileStat: stat,
          magicDirectoryIndex,
          magicExtensions: getExtensionsToTry(
            magicExtensions,
            reference.parentUrl,
          ),
        },
      )
      if (!filesystemResolution.found) {
        return null
      }
      const fileUrlRaw = filesystemResolution.url
      const fileUrl = `${fileUrlRaw}${search}${hash}`
      if (preservesSymlink) {
        return fileUrl
      }
      const realPath = realpathSync(urlObject)
      const realFileUrl = `${pathToFileURL(realPath)}${search}${hash}`
      return realFileUrl
    },
  }
}
