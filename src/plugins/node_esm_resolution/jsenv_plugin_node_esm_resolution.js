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
  packageConditions,
  filesInvalidatingCache = ["package.json", "package-lock.json"],
}) => {
  const unregisters = []
  let lookupPackageScope // defined in "init"
  let readPackageJson // defined in "init"

  return {
    name: "jsenv:node_esm_resolution",
    appliesDuring: "*",
    init: (context) => {
      const nodeRuntimeEnabled = Object.keys(context.runtimeCompat).includes(
        "node",
      )
      // https://nodejs.org/api/esm.html#resolver-algorithm-specification
      packageConditions = packageConditions || [
        ...readCustomConditionsFromProcessArgs(),
        nodeRuntimeEnabled ? "node" : "browser",
        "import",
      ]

      const packageScopesCache = new Map()
      lookupPackageScope = (url) => {
        const fromCache = packageScopesCache.get(url)
        if (fromCache) {
          return fromCache
        }
        const packageScope = defaultLookupPackageScope(url)
        packageScopesCache.set(url, packageScope)
        return packageScope
      }
      const packageJsonsCache = new Map()
      readPackageJson = (url) => {
        const fromCache = packageJsonsCache.get(url)
        if (fromCache) {
          return fromCache
        }
        const packageJson = defaultReadPackageJson(url)
        packageJsonsCache.set(url, packageJson)
        return packageJson
      }

      if (context.scenarios.dev) {
        const onFileChange = () => {
          packageScopesCache.clear()
          packageJsonsCache.clear()
        }
        filesInvalidatingCache.forEach((file) => {
          const unregister = registerFileLifecycle(
            new URL(file, context.rootDirectoryUrl),
            {
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
            },
          )
          unregisters.push(unregister)
        })
      }
    },
    resolveUrl: {
      js_import_export: (reference, context) => {
        const { parentUrl, specifier } = reference
        const nodeEsmResolutionResult = applyNodeEsmResolution({
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
          nodeEsmResolutionResult.type !== "relative_specifier" &&
          nodeEsmResolutionResult.type !== "absolute_specifier" &&
          nodeEsmResolutionResult.type !== "node_builtin_specifier"
        reference.dependsOnPackageJson = dependsOnPackageJson
        if (dependsOnPackageJson) {
          const rootPackageJsonUrl = new URL(
            "./package.json",
            context.rootDirectoryUrl,
          ).href
          const packageJsonUrl = `${nodeEsmResolutionResult.packageUrl}package.json`
          context.referenceUtils.inject({
            type: "programmatic_package_json",
            subtype: nodeEsmResolutionResult.type,
            specifier: packageJsonUrl,
          })
          if (packageJsonUrl !== rootPackageJsonUrl) {
            // injecting a reference to the root package.json for every
            // module resolved by node_esm means a modification to the root package.json
            // is considered as a change to all package.json inside node_modules/
            // this is a bazooka to avoid having to watch entire node_modules/
            // but when node_modules are watched (using custom clientFiles patterns)
            // we should disable this because it's too aggressive
            context.referenceUtils.inject({
              type: "programmatic_package_json",
              specifier: rootPackageJsonUrl,
            })
          }
        }
        return nodeEsmResolutionResult.url
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
      if (context.scenarios.build) {
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
