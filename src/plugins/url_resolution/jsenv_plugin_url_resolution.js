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
      reference.baseUrl || reference.parentUrl,
    ).href
  }

  const resolvers = {}
  Object.keys(urlResolution).forEach((referenceType) => {
    const resolver = urlResolution[referenceType]
    if (typeof resolver !== "object") {
      throw new Error(
        `Unexpected urlResolution configuration:
"${referenceType}" resolution value must be an object, got ${resolver}`,
      )
    }
    let { web = true, node_esm, ...rest } = resolver
    const unexpectedKey = Object.keys(rest)[0]
    if (unexpectedKey) {
      throw new Error(
        `Unexpected urlResolution configuration:
"${referenceType}" resolution key must be "web" or "node_esm", found "${
          Object.keys(rest)[0]
        }"`,
      )
    }
    if (node_esm === undefined && referenceType === "js_import_export") {
      node_esm = true
    }
    if (node_esm) {
      if (node_esm === true) node_esm = {}
      const { packageConditions } = node_esm
      resolvers[referenceType] = createNodeEsmResolver({
        runtimeCompat,
        packageConditions,
      })
    } else if (web) {
      resolvers[referenceType] = resolveUrlUsingWebResolution
    }
  })

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
      const resolver = resolvers[reference.type] || resolvers["*"]
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
