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
  packageConditionsConfig,
  preservesSymlink,
}) => {
  const buildPackageConditions = createBuildPackageConditions(
    packageConditions,
    {
      packageConditionsConfig,
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
    // specifiers like "#something" have a special meaning for Node.js
    // but can also be used in .css and .html files for example and should not be modified
    // by node esm resolution
    const webResolutionFallback =
      ownerUrlInfo.type !== "js_module" ||
      reference.type === "sourcemap_comment";
    const conditions = buildPackageConditions(specifier, parentUrl, {
      webResolutionFallback,
    });
    let resolution;
    const nodeEsmResolutionParams = {
      conditions,
      parentUrl,
      specifier,
      preservesSymlink,
    };
    if (webResolutionFallback) {
      try {
        resolution = applyNodeEsmResolution(nodeEsmResolutionParams);
      } catch {
        return null; // delegate to web_resolution plugin
      }
    } else {
      resolution = applyNodeEsmResolution(nodeEsmResolutionParams);
    }
    const { url, type, isMain, packageDirectoryUrl } = resolution;
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
  { packageConditionsConfig, rootDirectoryUrl, runtimeCompat },
) => {
  let resolveConditionsFromSpecifier = () => null;
  let resolveConditionsFromContext = () => [];
  from_specifier: {
    if (!packageConditionsConfig) {
      break from_specifier;
    }
    const keys = Object.keys(packageConditionsConfig);
    if (keys.length === 0) {
      break from_specifier;
    }

    const associationsRaw = {};
    for (const key of keys) {
      const associatedValue = packageConditionsConfig[key];

      if (!isBareSpecifier(key)) {
        const url = new URL(key, rootDirectoryUrl);
        associationsRaw[url] = associatedValue;
        continue;
      }
      try {
        if (key.endsWith("/")) {
          // avoid package path not exported

          const { packageDirectoryUrl } = applyNodeEsmResolution({
            specifier: key.slice(0, -1),
            parentUrl: rootDirectoryUrl,
          });
          const url = packageDirectoryUrl;
          associationsRaw[url] = associatedValue;
          continue;
        }
        const { url } = applyNodeEsmResolution({
          specifier: key,
          parentUrl: rootDirectoryUrl,
        });
        associationsRaw[url] = associatedValue;
      } catch {
        const url = new URL(key, rootDirectoryUrl);
        associationsRaw[url] = associatedValue;
      }
    }
    const associations = URL_META.resolveAssociations(
      {
        conditions: associationsRaw,
      },
      rootDirectoryUrl,
    );
    resolveConditionsFromSpecifier = (specifier, importer) => {
      let associatedValue;
      if (isBareSpecifier(specifier)) {
        const { url } = applyNodeEsmResolution({
          specifier,
          parentUrl: importer,
        });
        associatedValue = URL_META.applyAssociations({ url, associations });
      } else {
        associatedValue = URL_META.applyAssociations({
          url: importer,
          associations,
        });
      }
      if (!associatedValue) {
        return undefined;
      }
      if (associatedValue.conditions) {
        return associatedValue.conditions;
      }
      return undefined;
    };
  }
  from_context: {
    const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
    // https://nodejs.org/api/esm.html#resolver-algorithm-specification
    const devResolver = (specifier, importer, { webResolutionFallback }) => {
      if (isBareSpecifier(specifier)) {
        let url;
        if (webResolutionFallback) {
          try {
            const resolution = applyNodeEsmResolution({
              specifier,
              parentUrl: importer,
            });
            url = resolution.url;
          } catch {
            url = new URL(specifier, importer).href;
          }
        } else {
          const resolution = applyNodeEsmResolution({
            specifier,
            parentUrl: importer,
          });
          url = resolution.url;
        }
        return !url.includes("/node_modules/");
      }
      return !importer.includes("/node_modules/");
    };

    const conditionDefaultResolvers = {
      "dev:*": devResolver,
      "development": devResolver,
      "node": nodeRuntimeEnabled,
      "browser": !nodeRuntimeEnabled,
      "import": true,
    };
    const conditionResolvers = {
      ...conditionDefaultResolvers,
    };

    let wildcardToRemoveSet = new Set();
    const addCustomResolver = (condition, customResolver) => {
      for (const conditionCandidate of Object.keys(conditionDefaultResolvers)) {
        if (conditionCandidate.includes("*")) {
          const conditionRegex = new RegExp(
            `^${conditionCandidate.replace(/\*/g, "(.*)")}$`,
          );
          if (conditionRegex.test(condition)) {
            const existingResolver =
              conditionDefaultResolvers[conditionCandidate];
            wildcardToRemoveSet.add(conditionCandidate);
            conditionResolvers[condition] = combineTwoPackageConditionResolvers(
              existingResolver,
              customResolver,
            );
            return;
          }
        }
      }
      const existingResolver = conditionDefaultResolvers[condition];
      if (existingResolver) {
        conditionResolvers[condition] = combineTwoPackageConditionResolvers(
          existingResolver,
          customResolver,
        );
        return;
      }
      conditionResolvers[condition] = customResolver;
    };
    custom_resolvers_from_process_args: {
      const processArgConditions = readCustomConditionsFromProcessArgs();
      for (const processArgCondition of processArgConditions) {
        addCustomResolver(processArgCondition, true);
      }
    }
    custom_resolvers_from_package_conditions: {
      for (const key of Object.keys(packageConditions)) {
        const value = packageConditions[key];
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
              const { applies } = URL_META.applyAssociations({
                url,
                associations,
              });
              return applies;
            }
            const { applies } = URL_META.applyAssociations({
              url: importer,
              associations,
            });
            return applies;
          };
        } else if (typeof value === "function") {
          customResolver = value;
        } else {
          customResolver = value;
        }
        addCustomResolver(key, customResolver);
      }
    }
    for (const wildcardToRemove of wildcardToRemoveSet) {
      delete conditionResolvers[wildcardToRemove];
    }

    const conditionCandidateArray = Object.keys(conditionResolvers);
    resolveConditionsFromContext = (specifier, importer, params) => {
      const conditions = [];
      for (const conditionCandidate of conditionCandidateArray) {
        const conditionResolver = conditionResolvers[conditionCandidate];
        if (typeof conditionResolver === "function") {
          if (conditionResolver(specifier, importer, params)) {
            conditions.push(conditionCandidate);
          }
        } else if (conditionResolver) {
          conditions.push(conditionCandidate);
        }
      }
      return conditions;
    };
  }

  return (specifier, importer, params) => {
    const conditionsForThisSpecifier = resolveConditionsFromSpecifier(
      specifier,
      importer,
      params,
    );
    if (conditionsForThisSpecifier) {
      return conditionsForThisSpecifier;
    }
    const conditionsFromContext = resolveConditionsFromContext(
      specifier,
      importer,
      params,
    );
    if (conditionsFromContext) {
      return conditionsFromContext;
    }
    return [];
  };
};

const combineTwoPackageConditionResolvers = (first, second) => {
  if (typeof second !== "function") {
    return second;
  }
  return (...args) => {
    const secondResult = second(...args);
    if (secondResult !== undefined) {
      return secondResult;
    }
    if (typeof first === "function") {
      return first(...args);
    }
    return first;
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
