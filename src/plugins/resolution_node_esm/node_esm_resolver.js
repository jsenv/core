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
  defaultLookupPackageScope,
  defaultReadPackageJson,
  readCustomConditionsFromProcessArgs,
} from "@jsenv/node-esm-resolution";
import { readFileSync } from "node:fs";

export const createNodeEsmResolver = ({
  build,
  runtimeCompat,
  packageConditions,
  preservesSymlink,
}) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  packageConditions = packageConditions || [
    ...(build ? [] : readCustomConditionsFromProcessArgs()),
    nodeRuntimeEnabled ? "node" : "browser",
    "import",
  ];

  return (reference) => {
    if (reference.type === "package_json") {
      return reference.specifier;
    }
    const { ownerUrlInfo } = reference;
    if (reference.specifierPathname[0] === "/") {
      return null; // let it to jsenv_web_resolution
    }
    let parentUrl;
    if (reference.baseUrl) {
      parentUrl = reference.baseUrl;
    } else if (ownerUrlInfo.originalUrl?.startsWith("http")) {
      parentUrl = ownerUrlInfo.originalUrl;
    } else {
      parentUrl = ownerUrlInfo.url;
    }
    if (!parentUrl.startsWith("file:")) {
      return null; // let it to jsenv_web_resolution
    }
    const { url, type, packageDirectoryUrl } = applyNodeEsmResolution({
      conditions: packageConditions,
      parentUrl,
      specifier: reference.specifier,
      preservesSymlink,
    });
    if (ownerUrlInfo.context.build) {
      return url;
    }
    const dependsOnPackageJson =
      type !== "relative_specifier" &&
      type !== "absolute_specifier" &&
      type !== "node_builtin_specifier";
    if (dependsOnPackageJson) {
      // this reference depends on package.json and node_modules
      // to be resolved. Each file using this specifier
      // must be invalidated when corresponding package.json changes
      addRelationshipWithPackageJson({
        reference,
        packageJsonUrl: `${packageDirectoryUrl}package.json`,
        field: type.startsWith("field:")
          ? `#${type.slice("field:".length)}`
          : "",
      });
    }
    // without this check a file inside a project without package.json
    // could be considered as a node module if there is a ancestor package.json
    // but we want to version only node modules
    if (url.includes("/node_modules/")) {
      const packageDirectoryUrl = defaultLookupPackageScope(url);
      if (
        packageDirectoryUrl &&
        packageDirectoryUrl !== ownerUrlInfo.context.rootDirectoryUrl
      ) {
        const packageVersion =
          defaultReadPackageJson(packageDirectoryUrl).version;
        // package version can be null, see https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
        if (packageVersion) {
          addRelationshipWithPackageJson({
            reference,
            packageJsonUrl: `${packageDirectoryUrl}package.json`,
            field: "version",
            hasVersioningEffect: true,
          });
        }
        reference.version = packageVersion;
      }
    }
    return url;
  };
};

const addRelationshipWithPackageJson = ({
  reference,
  packageJsonUrl,
  field,
  hasVersioningEffect = false,
}) => {
  const { ownerUrlInfo } = reference;
  for (const referenceToOther of ownerUrlInfo.referenceToOthersSet) {
    if (
      referenceToOther.type === "package_json" &&
      referenceToOther.subtype === field
    ) {
      return;
    }
  }
  const packageJsonReference = reference.addImplicit({
    type: "package_json",
    subtype: field,
    specifier: packageJsonUrl,
    hasVersioningEffect,
    isWeak: true,
  });
  // we don't cook package.json files, we just maintain their content
  // to be able to check if it has changed later on
  if (packageJsonReference.urlInfo.content === undefined) {
    const packageJsonContentAsBuffer = readFileSync(new URL(packageJsonUrl));
    packageJsonReference.urlInfo.type = "json";
    packageJsonReference.urlInfo.kitchen.urlInfoTransformer.setContent(
      packageJsonReference.urlInfo,
      String(packageJsonContentAsBuffer),
    );
  }
};
