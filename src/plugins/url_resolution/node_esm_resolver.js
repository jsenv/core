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
  readCustomConditionsFromProcessArgs,
  defaultLookupPackageScope,
  defaultReadPackageJson,
} from "@jsenv/node-esm-resolution"

export const createNodeEsmResolver = ({ runtimeCompat, packageConditions }) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node")
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = packageConditions || [
    ...readCustomConditionsFromProcessArgs(),
    nodeRuntimeEnabled ? "node" : "browser",
    "import",
  ]

  return (reference, context) => {
    if (reference.type === "package_json") {
      return reference.specifier
    }
    const parentUrl = reference.baseUrl || reference.parentUrl
    if (!parentUrl.startsWith("file:")) {
      return new URL(reference.specifier, parentUrl).href
    }
    const { url, type, packageDirectoryUrl } = applyNodeEsmResolution({
      conditions: packageConditions,
      parentUrl,
      specifier: reference.specifier,
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
        addRelationshipWithPackageJson({
          reference,
          context,
          packageJsonUrl: `${packageDirectoryUrl}package.json`,
          field: type.startsWith("field:")
            ? `#${type.slice("field:".length)}`
            : "",
        })
      }
    }
    if (context.scenarios.dev) {
      // without this check a file inside a project without package.json
      // could be considered as a node module if there is a ancestor package.json
      // but we want to version only node modules
      if (url.includes("/node_modules/")) {
        const packageDirectoryUrl = defaultLookupPackageScope(url)
        if (
          packageDirectoryUrl &&
          packageDirectoryUrl !== context.rootDirectoryUrl
        ) {
          const packageVersion =
            defaultReadPackageJson(packageDirectoryUrl).version
          // package version can be null, see https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
          if (packageVersion) {
            addRelationshipWithPackageJson({
              reference,
              context,
              packageJsonUrl: `${packageDirectoryUrl}package.json`,
              field: "version",
              hasVersioningEffect: true,
            })
          }
          reference.version = packageVersion
        }
      }
    }
    return url
  }
}

const addRelationshipWithPackageJson = ({
  context,
  packageJsonUrl,
  field,
  hasVersioningEffect = false,
}) => {
  const referenceFound = context.referenceUtils.find(
    (ref) => ref.type === "package_json" && ref.subtype === field,
  )
  if (referenceFound) {
    return
  }
  const [, packageJsonUrlInfo] = context.referenceUtils.inject({
    type: "package_json",
    subtype: field,
    specifier: packageJsonUrl,
    isImplicit: true,
    hasVersioningEffect,
  })
  if (packageJsonUrlInfo.type === undefined) {
    const packageJsonContentAsBuffer = readFileSync(new URL(packageJsonUrl))
    packageJsonUrlInfo.type = "json"
    packageJsonUrlInfo.content = String(packageJsonContentAsBuffer)
    packageJsonUrlInfo.originalContentEtag = packageJsonUrlInfo.contentEtag =
      bufferToEtag(packageJsonContentAsBuffer)
  }
}
