/*
 * This plugin is responsible to resolve urls except for a few cases:
 * - A custom plugin implements a resolveUrl hook returning something
 * - The reference.type is "filesystem" -> it is handled by jsenv_plugin_file_urls.js
 *
 * By default node esm resolution applies inside js modules
 * and the rest uses the web standard url resolution (new URL):
 * - "http_request"
 * - "entry_point"
 * - "js_import_export"
 * - "link_href"
 * - "script_src"
 * - "a_href"
 * - "iframe_src
 * - "img_src"
 * - "img_srcset"
 * - "source_src"
 * - "source_srcset"
 * - "image_href"
 * - "use_href"
 * - "css_@import"
 * - "css_url"
 * - "sourcemap_comment"
 * - "js_url_specifier"
 * - "js_inline_content"
 * - "webmanifest_icon_src"
 * - "package_json"
 */

import { createNodeEsmResolver } from "./node_esm_resolver.js"

export const jsenvPluginUrlResolution = ({
  runtimeCompat,
  clientMainFileUrl,
  urlResolution,
}) => {
  const resolveUrlUsingWebResolution = (reference) => {
    return new URL(
      reference.specifier,
      // baseUrl happens second argument to new URL() is different from
      // import.meta.url or document.currentScript.src
      reference.baseUrl || reference.parentUrl,
    ).href
  }

  const resolvers = {}
  Object.keys(urlResolution).forEach((urlType) => {
    const resolver = urlResolution[urlType]
    if (typeof resolver !== "object") {
      throw new Error(
        `Unexpected urlResolution configuration:
"${urlType}" resolution value must be an object, got ${resolver}`,
      )
    }
    let { web, node_esm, ...rest } = resolver
    const unexpectedKey = Object.keys(rest)[0]
    if (unexpectedKey) {
      throw new Error(
        `Unexpected urlResolution configuration:
"${urlType}" resolution key must be "web" or "node_esm", found "${
          Object.keys(rest)[0]
        }"`,
      )
    }
    if (node_esm === undefined) {
      node_esm = urlType === "js_module"
    }
    if (web === undefined) {
      web = true
    }
    if (node_esm) {
      if (node_esm === true) node_esm = {}
      const { packageConditions } = node_esm
      resolvers[urlType] = createNodeEsmResolver({
        runtimeCompat,
        packageConditions,
      })
    } else if (web) {
      resolvers[urlType] = resolveUrlUsingWebResolution
    }
  })

  if (!resolvers.js_module) {
    resolvers.js_module = createNodeEsmResolver({ runtimeCompat })
  }
  if (!resolvers["*"]) {
    resolvers["*"] = resolveUrlUsingWebResolution
  }

  return {
    name: "jsenv:url_resolution",
    appliesDuring: "*",
    resolveUrl: (reference, context) => {
      if (reference.specifier === "/") {
        return String(clientMainFileUrl)
      }
      if (reference.specifier[0] === "/") {
        return new URL(reference.specifier.slice(1), context.rootDirectoryUrl)
          .href
      }
      if (reference.type === "sourcemap_comment") {
        return resolveUrlUsingWebResolution(reference, context)
      }
      let urlType
      if (reference.injected) {
        urlType = reference.expectedType
      } else {
        const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
        urlType = parentUrlInfo ? parentUrlInfo.type : "entry_point"
      }
      const resolver = resolvers[urlType] || resolvers["*"]
      return resolver(reference, context)
    },
    // when specifier is prefixed by "file:///@ignore/"
    // we return an empty js module (used by node esm)
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
          contentType: "text/javascript",
          type: "js_module",
        }
      }
      return null
    },
  }
}
