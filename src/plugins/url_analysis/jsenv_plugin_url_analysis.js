import {
  normalizeStructuredMetaMap,
  urlToMeta,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { parseAndTransformHtmlUrls } from "./html/html_urls.js"
import { parseAndTransformCssUrls } from "./css/css_urls.js"
import { parseAndTransformJsUrls } from "./js/js_urls.js"
import { parseAndTransformWebmanifestUrls } from "./webmanifest/webmanifest_urls.js"

export const jsenvPluginUrlAnalysis = ({ rootDirectoryUrl, include }) => {
  let getIncludeInfo = () => undefined
  if (include) {
    const includeMetaMap = normalizeStructuredMetaMap(
      {
        include,
      },
      rootDirectoryUrl,
    )
    getIncludeInfo = (url) => {
      const meta = urlToMeta({
        url,
        structuredMetaMap: includeMetaMap,
      })
      return meta.include
    }
  }

  return {
    name: "jsenv:url_analysis",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      if (
        reference.specifier[0] === "#" &&
        // For Html, css and in general "#" refer to a ressource in the page
        // so that urls must be kept intact
        // However for js import specifiers they have a different meaning and we want
        // to resolve them (https://nodejs.org/api/packages.html#imports for instance)
        reference.type !== "js_import_export"
      ) {
        reference.shouldHandle = false
        return
      }
      const includeInfo = getIncludeInfo(reference.url)
      if (includeInfo === true) {
        reference.shouldHandle = true
        return
      }
      if (includeInfo === false) {
        reference.shouldHandle = false
        return
      }
      if (reference.url.startsWith("data:")) {
        reference.shouldHandle = true
        return
      }
      if (reference.url.startsWith("file:")) {
        reference.shouldHandle = true
        return
      }
    },
    transformUrlContent: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsUrls,
      js_module: parseAndTransformJsUrls,
      webmanifest: parseAndTransformWebmanifestUrls,
      directory: (urlInfo, context) => {
        const originalDirectoryReference = findOriginalDirectoryReference(
          urlInfo,
          context,
        )
        const directoryRelativeUrl = urlToRelativeUrl(
          urlInfo.url,
          context.rootDirectoryUrl,
        )
        JSON.parse(urlInfo.content).forEach((directoryEntry) => {
          context.referenceUtils.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: directoryEntry,
            trace: `"${directoryRelativeUrl}${directoryEntry}" entry in directory referenced by ${originalDirectoryReference.trace}`,
          })
        })
      },
    },
  }
}

const findOriginalDirectoryReference = (urlInfo, context) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const dependentUrl of urlInfo.dependents) {
      const dependentUrlInfo = context.urlGraph.getUrlInfo(dependentUrl)
      if (dependentUrlInfo.type !== "directory") {
        return [dependentUrlInfo, urlInfo]
      }
      const found = findNonFileSystemAncestor(dependentUrlInfo)
      if (found) {
        return found
      }
    }
    return []
  }
  const [ancestor, child] = findNonFileSystemAncestor(urlInfo)
  if (!ancestor) {
    return null
  }
  const ref = ancestor.references.find((ref) => ref.url === child.url)
  return ref
}
