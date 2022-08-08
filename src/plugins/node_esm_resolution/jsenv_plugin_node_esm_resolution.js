/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */

import { existsSync } from "node:fs"
import { registerFileLifecycle } from "@jsenv/filesystem"
import { urlIsInsideOf } from "@jsenv/urls"

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
  let rootPackageJsonUrl // defined in "init"
  let lookupPackageScope // defined in "init"
  let readPackageJson // defined in "init"
  // When "injectReferenceToRootPackage" is enabled
  // updating the root package.json is handled as updating all package.json
  // This exists because
  // - watching node_modules might consume a lot of ressources
  // - most of the time the content of node_modules do not change
  // - most of the time the content of node_modules is updated after an update to the root
  // package.json done by npm commands
  // So by default jsenv do not watch node_modules and a change to the root package.json
  // is handled as a change to a package.json inside node_modules/
  // This is disabled when
  // - root package.json do not exists
  // - the package.json is watched (a custom clientFiles enabled for node_modules for instance)
  let injectReferenceToRootPackage = false

  const injectDependencyToPackageFile = ({
    packageDirectoryUrl,
    packageFieldName,
    context,
  }) => {
    const packageJsonUrl = new URL("./package.json", packageDirectoryUrl).href
    if (!context.referenceUtils) {
      debugger
    }
    const [, packageJsonUrlInfo] = context.referenceUtils.inject({
      type: "package_json",
      subtype: packageFieldName,
      specifier: packageJsonUrl,
    })
    if (
      !packageJsonUrlInfo.isWatched &&
      injectReferenceToRootPackage &&
      !urlIsInsideOf(context.rootDirectoryUrl, packageDirectoryUrl)
    ) {
      context.referenceUtils.inject({
        type: "package_json",
        specifier: rootPackageJsonUrl,
      })
    }
  }

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

      rootPackageJsonUrl = new URL("./package.json", context.rootDirectoryUrl)
        .href

      if (context.scenarios.dev) {
        injectReferenceToRootPackage = existsSync(rootPackageJsonUrl)
        const onFileChange = () => {
          packageScopesCache.clear()
          packageJsonsCache.clear()
          const rootPackageUrlInfo =
            context.urlGraph.getUrlInfo(rootPackageJsonUrl)
          if (rootPackageUrlInfo) {
            context.urlGraph.considerModified(rootPackageUrlInfo)
          }
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
        const { url, type, packageUrl } = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
          lookupPackageScope,
          readPackageJson,
        })
        // this reference depends on package.json and node_modules
        // to be resolved. Each file using this specifier
        // must be invalidated when package.json or package_lock.json
        // changes
        const dependsOnPackageJson =
          type !== "relative_specifier" &&
          type !== "absolute_specifier" &&
          type !== "node_builtin_specifier"
        reference.dependsOnPackageJson = dependsOnPackageJson
        if (dependsOnPackageJson) {
          injectDependencyToPackageFile({
            packageDirectoryUrl: packageUrl,
            packageFieldName: type.startsWith("field:")
              ? type.slice("field:".length)
              : null,
            context,
          })
        }
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
      if (reference.type === "package_json") {
        return null
      }
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
      const packageDirectoryUrl = lookupPackageScope(reference.url)
      if (!packageDirectoryUrl) {
        return null
      }
      if (packageDirectoryUrl === context.rootDirectoryUrl) {
        return null
      }
      // there is a dependency between this file and the package.json version field
      const packageVersion = readPackageJson(packageDirectoryUrl).version
      if (!packageVersion) {
        // example where it happens: https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
        return null
      }
      injectDependencyToPackageFile({
        packageDirectoryUrl,
        packageFieldName: "version",
        context,
      })
      return {
        v: packageVersion,
      }
    },
    destroy: () => {
      unregisters.forEach((unregister) => unregister())
    },
  }
}
