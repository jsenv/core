import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs"
import { pathToFileURL } from "node:url"
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToFilename,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls"
import {
  applyFileSystemMagicResolution,
  getExtensionsToTry,
} from "@jsenv/node-esm-resolution"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

export const jsenvPluginFileUrls = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preserveSymlinks = false,
  directoryReferenceAllowed = false,
}) => {
  return [
    {
      name: "jsenv:file_url_resolution",
      appliesDuring: "*",
      redirectUrl: (reference) => {
        // http, https, data, about, ...
        if (!reference.url.startsWith("file:")) {
          return null
        }
        if (reference.isInline) {
          return null
        }
        const urlObject = new URL(reference.url)
        let stat
        try {
          stat = statSync(urlObject)
        } catch (e) {
          if (e.code === "ENOENT") {
            stat = null
          } else {
            throw e
          }
        }
        const { search, hash } = urlObject
        let { pathname } = urlObject
        const pathnameUsesTrailingSlash = pathname.endsWith("/")
        urlObject.search = ""
        urlObject.hash = ""
        // force trailing slash on directories
        if (stat && stat.isDirectory() && !pathnameUsesTrailingSlash) {
          urlObject.pathname = `${pathname}/`
        }
        // otherwise remove trailing slash if any
        if (stat && !stat.isDirectory() && pathnameUsesTrailingSlash) {
          // a warning here? (because it's strange to reference a file with a trailing slash)
          urlObject.pathname = pathname.slice(0, -1)
        }

        let url = urlObject.href
        const shouldPreserve =
          stat &&
          stat.isDirectory() &&
          // ignore new URL second arg
          (reference.subtype === "new_url_second_arg" ||
            // ignore root file url
            reference.url === "file:///" ||
            (reference.subtype === "new_url_first_arg" &&
              reference.specifier === "./"))

        if (shouldPreserve) {
          reference.shouldHandle = false
        } else {
          const shouldApplyDilesystemMagicResolution =
            !stat && reference.type !== "js_url"
          if (shouldApplyDilesystemMagicResolution) {
            const filesystemResolution = applyFileSystemMagicResolution(url, {
              fileStat: stat,
              magicDirectoryIndex,
              magicExtensions: getExtensionsToTry(
                magicExtensions,
                reference.parentUrl,
              ),
            })
            stat = filesystemResolution.stat
            if (stat) {
              url = filesystemResolution.url
            }
          }
          if (stat && stat.isDirectory()) {
            const directoryAllowed =
              reference.type === "filesystem" ||
              (typeof directoryReferenceAllowed === "function" &&
                directoryReferenceAllowed(reference)) ||
              directoryReferenceAllowed
            if (!directoryAllowed) {
              const error = new Error("Reference leads to a directory")
              error.code = "DIRECTORY_REFERENCE_NOT_ALLOWED"
              throw error
            }
          }
        }
        reference.leadsToADirectory = stat && stat.isDirectory()
        if (stat) {
          const urlRaw = preserveSymlinks ? url : resolveSymlink(url)
          const resolvedUrl = `${urlRaw}${search}${hash}`
          return resolvedUrl
        }
        return null
      },
    },
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
      // during dev and test it's a browser running the code
      // so absolute file urls needs to be relativized
      // during build it's fine to use file:// urls
      appliesDuring: "dev",
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
        if (context.reference.leadsToADirectory) {
          const directoryEntries = readdirSync(urlObject)
          let filename
          if (context.reference.type === "filesystem") {
            const parentUrlInfo = context.urlGraph.getUrlInfo(
              context.reference.parentUrl,
            )
            filename = `${parentUrlInfo.filename}${context.reference.specifier}/`
          } else {
            filename = `${urlToFilename(urlInfo.url)}/`
          }
          return {
            type: "directory",
            contentType: "application/json",
            content: JSON.stringify(directoryEntries, null, "  "),
            filename,
          }
        }
        const fileBuffer = readFileSync(urlObject)
        const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url)
        return {
          content: CONTENT_TYPE.isTextual(contentType)
            ? String(fileBuffer)
            : fileBuffer,
          contentType,
        }
      },
    },
  ]
}

const resolveSymlink = (fileUrl) => {
  return pathToFileURL(realpathSync(new URL(fileUrl))).href
}
