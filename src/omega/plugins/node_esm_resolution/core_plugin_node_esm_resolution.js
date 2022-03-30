/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */

import {
  applyNodeEsmResolution,
  lookupPackageScope,
  readPackageJson,
} from "@jsenv/core/packages/node-esm-resolution/main.js"

export const corePluginNodeEsmResolution = ({
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = ["browser", "import"],
} = {}) => {
  const nodeEsmResolution = {
    name: "jsenv:node_esm_resolve",
    appliesDuring: "*",
    resolve: {
      js_import_export: ({ parentUrl, specifier }) => {
        const { url } = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
        })
        return url
      },
    },
    load: ({ url }) => {
      if (url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
        }
      }
      return null
    },
  }

  const packageVersionInUrl = {
    name: "jsenv:package_url_version",
    appliesDuring: {
      dev: true,
      test: true,
    },
    transformReferencedUrl: ({ url }, { rootDirectoryUrl }) => {
      if (!url.startsWith("file:")) {
        return null
      }
      // without this check a file inside a project without package.json
      // could be considered as a node module if there is a ancestor package.json
      // but we want to version only node modules
      if (!url.includes("/node_modules/")) {
        return null
      }
      const urlObject = new URL(url)
      if (urlObject.searchParams.has("v")) {
        return null
      }
      const packageUrl = lookupPackageScope(url)
      if (!packageUrl) {
        return null
      }
      if (packageUrl === rootDirectoryUrl) {
        return null
      }
      const packageVersion = readPackageJson(packageUrl).version
      urlObject.searchParams.set("v", packageVersion)
      return urlObject.href
    },
  }

  return [nodeEsmResolution, packageVersionInUrl]
}
