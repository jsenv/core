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
import { URL_META } from "@jsenv/url-meta";
import { urlToBasename, urlToExtension } from "@jsenv/urls";
import { readFileSync } from "node:fs";

export const createNodeEsmResolver = ({
  runtimeCompat,
  rootDirectoryUrl,
  packageConditions = {},
  preservesSymlink,
}) => {
  const buildPackageConditions = createBuildPackageConditions(
    packageConditions,
    {
      rootDirectoryUrl,
      runtimeCompat,
    },
  );

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
    const { specifier } = reference;
    const conditions = buildPackageConditions(specifier, parentUrl);
    const { url, type, isMain, packageDirectoryUrl } = applyNodeEsmResolution({
      conditions,
      parentUrl,
      specifier,
      preservesSymlink,
    });
    // try to give a more meaningful filename after build
    if (isMain && packageDirectoryUrl) {
      const basename = urlToBasename(url);
      if (basename === "main" || basename === "index") {
        const parentBasename = urlToBasename(new URL("../../", url));
        const dirname = urlToBasename(packageDirectoryUrl);
        let filenameHint = "";
        if (parentBasename[0] === "@") {
          filenameHint += `${parentBasename}_`;
        }
        const extension = urlToExtension(url);
        filenameHint += `${dirname}_${basename}${extension}`;
        reference.filenameHint = filenameHint;
      }
    }
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

const createBuildPackageConditions = (
  packageConditions,
  { rootDirectoryUrl, runtimeCompat },
) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  // https://nodejs.org/api/esm.html#resolver-algorithm-specification
  const processArgConditions = readCustomConditionsFromProcessArgs();
  const packageConditionsDefaultResolvers = {};
  for (const processArgCondition of processArgConditions) {
    packageConditionsDefaultResolvers[processArgCondition] = true;
  }
  const devResolver = (specifier, importer) => {
    if (isBareSpecifier(specifier)) {
      const { url } = applyNodeEsmResolution({
        specifier,
        parentUrl: importer,
      });
      return !url.includes("/node_modules/");
    }
    return !importer.includes("/node_modules/");
  };
  const packageConditionResolvers = {
    ...packageConditionsDefaultResolvers,
    "development": devResolver,
    "dev:*": devResolver,
    "node": nodeRuntimeEnabled,
    "browser": !nodeRuntimeEnabled,
    "import": true,
  };
  for (const condition of Object.keys(packageConditions)) {
    const value = packageConditions[condition];
    let customResolver;
    if (typeof value === "object") {
      const associations = URL_META.resolveAssociations(
        { applies: value },
        (pattern) => {
          if (isBareSpecifier(pattern)) {
            try {
              if (pattern.endsWith("/")) {
                // avoid package path not exported
                const { packageDirectoryUrl } = applyNodeEsmResolution({
                  specifier: pattern.slice(0, -1),
                  parentUrl: rootDirectoryUrl,
                });
                return packageDirectoryUrl;
              }
              const { url } = applyNodeEsmResolution({
                specifier: pattern,
                parentUrl: rootDirectoryUrl,
              });
              return url;
            } catch {
              return new URL(pattern, rootDirectoryUrl);
            }
          }
          return new URL(pattern, rootDirectoryUrl);
        },
      );
      customResolver = (specifier, importer) => {
        if (isBareSpecifier(specifier)) {
          const { url } = applyNodeEsmResolution({
            specifier,
            parentUrl: importer,
          });
          const { applies } = URL_META.applyAssociations({ url, associations });
          return applies;
        }
        return URL_META.applyAssociations({ url: importer, associations })
          .applies;
      };
    } else if (typeof value === "function") {
      customResolver = value;
    } else {
      customResolver = () => value;
    }
    const existing = packageConditionResolvers[condition];
    if (existing) {
      packageConditionResolvers[condition] = (...args) => {
        const customResult = customResolver(...args);
        return customResult === undefined ? existing(...args) : customResult;
      };
    } else {
      packageConditionResolvers[condition] = customResolver;
    }
  }

  return (specifier, importer) => {
    const conditions = [];
    for (const conditionCandidate of Object.keys(packageConditionResolvers)) {
      const packageConditionResolver =
        packageConditionResolvers[conditionCandidate];
      if (typeof packageConditionResolver === "function") {
        if (packageConditionResolver(specifier, importer)) {
          conditions.push(conditionCandidate);
        }
      } else if (packageConditionResolver) {
        conditions.push(conditionCandidate);
      }
    }
    return conditions;
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

const isBareSpecifier = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};
