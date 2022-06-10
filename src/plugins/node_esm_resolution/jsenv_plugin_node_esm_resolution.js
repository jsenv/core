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
  runtimeCompat,
  packageConditions,
  filesInvalidatingCache = ["package.json", "package-lock.json"],
}) => {
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
  filesInvalidatingCache.forEach((file) => {
    const unregister = registerFileLifecycle(new URL(file, rootDirectoryUrl), {
      added: () => {
        packageScopesCache.clear()
        packageJsonsCache.clear()
      },
      updated: () => {
        packageScopesCache.clear()
        packageJsonsCache.clear()
      },
      removed: () => {
        packageScopesCache.clear()
        packageJsonsCache.clear()
      },
      keepProcessAlive: false,
    })
    unregisters.push(unregister)
  })

  return [
    jsenvPluginNodeEsmResolver({
      runtimeCompat,
      packageConditions,
      lookupPackageScope,
      readPackageJson,
    }),
    jsenvPluginNodeModulesVersionInUrls({
      lookupPackageScope,
      readPackageJson,
    }),
  ]
}

const jsenvPluginNodeEsmResolver = ({
  runtimeCompat,
  packageConditions,
  lookupPackageScope,
  readPackageJson,
}) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node")
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = packageConditions || [
    ...readCustomConditionsFromProcessArgs(),
    nodeRuntimeEnabled ? "node" : "browser",
    "import",
  ]
  return {
    name: "jsenv:node_esm_resolve",
    appliesDuring: "*",
    resolveUrl: {
      js_import_export: (reference) => {
        const { parentUrl, specifier } = reference
        const { url } = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
          lookupPackageScope,
          readPackageJson,
        })
        return url
      },
    },
    fetchUrlContent: (urlInfo) => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}",
        }
      }
      return null
    },
  }
}

const jsenvPluginNodeModulesVersionInUrls = ({
  lookupPackageScope,
  readPackageJson,
}) => {
  return {
    name: "jsenv:node_modules_version_in_urls",
    appliesDuring: {
      dev: true,
      test: true,
    },
    transformUrlSearchParams: (reference, context) => {
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
  }
}
