/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */

import { readFileSync } from "node:fs"
import { bufferToEtag } from "@jsenv/filesystem"

import {
  applyNodeEsmResolution,
  defaultLookupPackageScope,
  defaultReadPackageJson,
  readCustomConditionsFromProcessArgs,
} from "@jsenv/node-esm-resolution"

export const jsenvPluginNodeEsmResolution = ({ packageConditions }) => {
  const unregisters = []

  const injectDependencyToPackageFile = ({
    packageDirectoryUrl,
    packageFieldName,
    propagateToAncestors = false,
    context,
  }) => {
    const packageJsonUrl = new URL("./package.json", packageDirectoryUrl).href
    const urlInfo = context.urlGraph.reuseOrCreateUrlInfo(
      context.reference.parentUrl,
    )
    const referenceFound = urlInfo.references.find(
      (ref) => ref.type === "package_json" && ref.subtype === packageFieldName,
    )
    if (referenceFound) {
      return
    }
    urlInfo.relateds.add(packageJsonUrl)
    const [, packageJsonUrlInfo] = context.referenceUtils.inject({
      type: "package_json",
      subtype: packageFieldName,
      specifier: packageJsonUrl,
    })
    if (packageJsonUrlInfo.type === undefined) {
      const packageJsonContentAsBuffer = readFileSync(new URL(packageJsonUrl))
      packageJsonUrlInfo.type = "json"
      packageJsonUrlInfo.content = String(packageJsonContentAsBuffer)
      packageJsonUrlInfo.originalContentEtag = packageJsonUrlInfo.contentEtag =
        bufferToEtag(packageJsonContentAsBuffer)
    }

    if (propagateToAncestors) {
      const propagateToDependents = () => {
        urlInfo.dependents.forEach((dependent) => {
          const dependentUrlInfo = context.urlGraph.getUrlInfo(dependent)
          dependentUrlInfo.relateds.add(packageJsonUrl)
          propagateToDependents(dependentUrlInfo)
        })
      }
      propagateToDependents(urlInfo)
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
    },
    resolveUrl: {
      js_import_export: (reference, context) => {
        const { parentUrl, specifier } = reference
        const { url, type, packageUrl } = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
        })
        if (context.scenarios.dev) {
          const dependsOnPackageJson =
            type !== "relative_specifier" &&
            type !== "absolute_specifier" &&
            type !== "node_builtin_specifier"
          if (dependsOnPackageJson) {
            // this reference depends on package.json and node_modules
            // to be resolved. Each file using this specifier
            // must be invalidated when corresponding package.json changes
            injectDependencyToPackageFile({
              packageDirectoryUrl: packageUrl,
              packageFieldName: type.startsWith("field:")
                ? type.slice("field:".length)
                : null,
              context,
            })
          }
        }
        return url
      },
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
      const packageDirectoryUrl = defaultLookupPackageScope(reference.url)
      if (!packageDirectoryUrl) {
        return null
      }
      if (packageDirectoryUrl === context.rootDirectoryUrl) {
        return null
      }
      // there is a dependency between this file and the package.json version field
      const packageVersion = defaultReadPackageJson(packageDirectoryUrl).version
      if (!packageVersion) {
        // example where it happens: https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
        return null
      }
      if (context.scenarios.dev && reference.type !== "http_request") {
        injectDependencyToPackageFile({
          packageDirectoryUrl,
          packageFieldName: "version",
          context,
          // because versioning must be disabled until
          // we found something not versioned (html for instance)
          // and reconstruct graph from there as files are put in browser cache
          propagateToAncestors: true,
        })
      }
      return {
        v: packageVersion,
      }
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
    destroy: () => {
      unregisters.forEach((unregister) => unregister())
    },
  }
}
