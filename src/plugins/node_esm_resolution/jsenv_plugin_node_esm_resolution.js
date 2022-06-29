/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */

import { registerFileLifecycle } from "@jsenv/filesystem"

import {
  applyNodeEsmResolution,
  defaultLookupPackageScope,
  defaultReadPackageJson,
  readCustomConditionsFromProcessArgs,
} from "@jsenv/node-esm-resolution"

export const jsenvPluginNodeEsmResolution = ({
  rootDirectoryUrl,
  urlGraph,
  runtimeCompat,
  packageConditions,
  filesInvalidatingCache = ["package.json", "package-lock.json"],
}) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node")
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = packageConditions || [
    ...readCustomConditionsFromProcessArgs(),
    nodeRuntimeEnabled ? "node" : "browser",
    "import",
  ]

  const packageScopesCache = new Map()
  const lookupPackageScope = (url) => {
    const fromCache = packageScopesCache.get(url)
    if (fromCache) {
      return fromCache
    }
    const packageScope = defaultLookupPackageScope(url)
    packageScopesCache.set(url, packageScope)
    return packageScope
  }
  const packageJsonsCache = new Map()
  const readPackageJson = (url) => {
    const fromCache = packageJsonsCache.get(url)
    if (fromCache) {
      return fromCache
    }
    const packageJson = defaultReadPackageJson(url)
    packageJsonsCache.set(url, packageJson)
    return packageJson
  }

  const unregisters = []
  const onFileChange = () => {
    packageScopesCache.clear()
    packageJsonsCache.clear()
    Object.keys(urlGraph.urlInfos).forEach((url) => {
      const urlInfo = urlGraph.getUrlInfo(url)
      if (urlInfo.data.dependsOnPackageJson) {
        urlGraph.considerModified(urlInfo)
      }
    })
  }
  filesInvalidatingCache.forEach((file) => {
    const unregister = registerFileLifecycle(new URL(file, rootDirectoryUrl), {
      added: () => {
        onFileChange()
      },
      updated: () => {
        onFileChange()
      },
      removed: () => {
        onFileChange()
      },
      keepProcessAlive: false,
    })
    unregisters.push(unregister)
  })

  return {
    name: "jsenv:node_esm_resolution",
    appliesDuring: "*",
    resolveUrl: {
      js_import_export: (reference) => {
        const { parentUrl, specifier } = reference
        const { type, url } = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
          lookupPackageScope,
          readPackageJson,
        })

        // this reference depend on package.json and node_modules
        // to be resolved. Each file using this specifier
        // must be invalidated when package.json or package_lock.json
        // changes
        const dependsOnPackageJson =
          type !== "relative_specifier" &&
          type !== "absolute_specifier" &&
          type !== "node_builtin_specifier"
        const relatedUrlInfos = urlGraph.getRelatedUrlInfos(reference.parentUrl)
        relatedUrlInfos.forEach((relatedUrlInfo) => {
          relatedUrlInfo.data.dependsOnPackageJson = dependsOnPackageJson
        })
        return url
      },
    },
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
    transformUrlSearchParams: (reference, context) => {
      if (context.scenario === "build") {
        return null
      }
      if (!reference.url.startsWith("file:")) {
        return null
      }
      // without this check a file inside a project without package.json
      // could be considered as a node module if there is a ancestor package.json
      // but we want to version only node modules
      if (!reference.url.includes("/node_modules/")) {
        return null
      }
      if (reference.searchParams.has("v")) {
        return null
      }
      const packageUrl = lookupPackageScope(reference.url)
      if (!packageUrl) {
        return null
      }
      if (packageUrl === context.rootDirectoryUrl) {
        return null
      }
      const packageVersion = readPackageJson(packageUrl).version
      if (!packageVersion) {
        // example where it happens: https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
        return null
      }
      return {
        v: packageVersion,
      }
    },
    destroy: () => {
      unregisters.forEach((unregister) => unregister())
    },
  }
}
