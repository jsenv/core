// see https://github.com/rollup/rollup/blob/ce453507ab8457dd1ea3909d8dd7b117b2d14fab/src/utils/hashPlaceholders.ts#L1

import { createHash } from "node:crypto";
import {
  injectQueryParamIntoSpecifierWithoutEncoding,
  renderUrlOrRelativeUrlFilename,
} from "@jsenv/urls";
import { parseHtmlString, stringifyHtmlAst } from "@jsenv/ast";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { isWebWorkerUrlInfo } from "../kitchen/web_workers.js";
import {
  injectVersionMappingsAsGlobal,
  injectVersionMappingsAsImportmap,
} from "./version_mappings_injection.js";

const placeholderLeft = "!~{";
const placeholderRight = "}~";
const placeholderOverhead = placeholderLeft.length + placeholderRight.length;

export const createBuildVersionsManager = ({
  finalKitchen,
  versioningMethod,
  versionLength = 8,
  canUseImportmap,
  getUrlInfoFromBuildSpecifier,
}) => {
  const workerReferenceSet = new Set();
  const isReferencedByWorker = (reference) => {
    if (workerReferenceSet.has(reference)) {
      return true;
    }
    const referencedUrlInfo = reference.urlInfo;
    const dependentWorker = GRAPH_VISITOR.findDependent(
      finalKitchen.graph,
      referencedUrlInfo,
      (dependentUrlInfo) => {
        return isWebWorkerUrlInfo(dependentUrlInfo);
      },
    );
    if (dependentWorker) {
      workerReferenceSet.add(reference);
      return true;
    }
    return Boolean(dependentWorker);
  };

  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
  const base = 64;
  const toBase64 = (value) => {
    let outString = "";
    do {
      const currentDigit = value % base;
      value = (value / base) | 0;
      outString = chars[currentDigit] + outString;
    } while (value !== 0);
    return outString;
  };

  let nextIndex = 0;
  const generatePlaceholder = () => {
    nextIndex++;
    const id = toBase64(nextIndex);
    let placeholder = placeholderLeft;
    placeholder += id.padStart(versionLength - placeholderOverhead, "0");
    placeholder += placeholderRight;
    return placeholder;
  };

  const replaceFirstPlaceholder = (code, value) => {
    let replaced = false;
    return code.replace(REPLACER_REGEX, (match) => {
      if (replaced) return match;
      replaced = true;
      return value;
    });
  };

  const defaultPlaceholder = `${placeholderLeft}${"0".repeat(
    versionLength - placeholderOverhead,
  )}${placeholderRight}`;
  const replaceWithDefaultAndPopulateContainedPlaceholders = (
    code,
    containedPlaceholders,
  ) => {
    const transformedCode = code.replace(REPLACER_REGEX, (placeholder) => {
      containedPlaceholders.add(placeholder);
      return defaultPlaceholder;
    });
    return transformedCode;
  };

  // https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
  // https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
  const generateVersion = (parts) => {
    const hash = createHash("sha256");
    parts.forEach((part) => {
      hash.update(part);
    });
    return hash.digest("hex").slice(0, versionLength);
  };

  const REPLACER_REGEX = new RegExp(
    `${escapeRegexpSpecialChars(placeholderLeft)}[0-9a-zA-Z_$]{1,${
      versionLength - placeholderOverhead
    }}${escapeRegexpSpecialChars(placeholderRight)}`,
    "g",
  );

  const referenceToPlaceholderMap = new Map();
  const placeholderToReferenceMap = new Map();
  const buildSpecifierPlaceholderMap = new Map();
  const buildSpecifierVersionedMap = new Map();

  const onPlaceholderGenerated = (
    reference,
    buildSpecifier,
    buildSpecifierPlaceholder,
  ) => {
    buildSpecifierPlaceholderMap.set(buildSpecifier, buildSpecifierPlaceholder);
    referenceToPlaceholderMap.set(reference, buildSpecifierPlaceholder);
    placeholderToReferenceMap.set(buildSpecifierPlaceholder, reference);
  };

  const referenceVersionedExternallyMap = new Map();
  const specifierVersionedInlineSet = new Set();
  const specifierVersionedByCodeSet = new Set();
  const specifierVersionedByImportmapSet = new Set();
  const versionMap = new Map();

  return {
    generateBuildSpecifierPlaceholder: (reference, buildSpecifier) => {
      const existing = referenceToPlaceholderMap.get(reference);
      if (existing) return existing;

      const asPlaceholderForVersionedSpecifier = () => {
        specifierVersionedInlineSet.add(buildSpecifier);
        const placeholder = generatePlaceholder();
        const buildSpecifierWithVersionPlaceholder =
          injectVersionPlaceholderIntoBuildSpecifier({
            buildSpecifier,
            versionPlaceholder: placeholder,
            versioningMethod,
          });
        onPlaceholderGenerated(
          reference,
          buildSpecifier,
          buildSpecifierWithVersionPlaceholder,
        );
        return buildSpecifierWithVersionPlaceholder;
      };

      const asPlaceholderForCodeVersionedByGlobalRegistry = (codeToInject) => {
        specifierVersionedByCodeSet.add(buildSpecifier);
        referenceVersionedExternallyMap.add(reference, codeToInject);
        const placeholder = generatePlaceholder();
        onPlaceholderGenerated(reference, buildSpecifier, placeholder);
        return placeholder;
      };

      const asPlaceholderForSpecifierVersionedByImportmap = (
        specifierToUse,
      ) => {
        specifierVersionedByImportmapSet.add(buildSpecifier);
        referenceVersionedExternallyMap.add(reference, specifierToUse);
        onPlaceholderGenerated(reference, buildSpecifier, specifierToUse);
        return specifierToUse;
      };

      const ownerUrlInfo = reference.ownerUrlInfo;
      if (ownerUrlInfo.jsQuote) {
        return asPlaceholderForCodeVersionedByGlobalRegistry(
          `${ownerUrlInfo.jsQuote}+__v__(${JSON.stringify(buildSpecifier)})+${
            ownerUrlInfo.jsQuote
          }`,
        );
      }
      if (reference.type === "js_url") {
        return asPlaceholderForCodeVersionedByGlobalRegistry(
          `__v__(${JSON.stringify(buildSpecifier)})`,
        );
      }
      if (reference.type === "js_import") {
        if (reference.subtype === "import_dynamic") {
          return asPlaceholderForCodeVersionedByGlobalRegistry(
            `__v__(${JSON.stringify(buildSpecifier)})`,
          );
        }
        if (reference.subtype === "import_meta_resolve") {
          return asPlaceholderForCodeVersionedByGlobalRegistry(
            `__v__(${JSON.stringify(buildSpecifier)})`,
          );
        }
        if (canUseImportmap && !isReferencedByWorker(reference)) {
          return asPlaceholderForSpecifierVersionedByImportmap(
            JSON.stringify(buildSpecifier),
          );
        }
      }
      return asPlaceholderForVersionedSpecifier();
    },
    applyVersioning: async (finalKitchen) => {
      workerReferenceSet.clear();

      const contentOnlyVersionMap = new Map();
      generate_content_only_versions: {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          // ignore:
          // - inline files and data files:
          //   they are already taken into account in the file where they appear
          // - ignored files:
          //   we don't know their content
          // - unused files without reference
          //   File updated such as style.css -> style.css.js or file.js->file.nomodule.js
          //   Are used at some point just to be discarded later because they need to be converted
          //   There is no need to version them and we could not because the file have been ignored
          //   so their content is unknown
          if (urlInfo.isRoot) {
            return;
          }
          if (urlInfo.type === "sourcemap") {
            return;
          }
          if (urlInfo.isInline) {
            return;
          }
          if (urlInfo.url.startsWith("data:")) {
            // urlInfo became inline and is not referenced by something else
            return;
          }
          if (urlInfo.url.startsWith("ignore:")) {
            return;
          }
          if (!urlInfo.isUsed()) {
            return;
          }
          let content = urlInfo.content;
          if (urlInfo.type === "html") {
            content = stringifyHtmlAst(
              parseHtmlString(urlInfo.content, {
                storeOriginalPositions: false,
              }),
              {
                cleanupJsenvAttributes: true,
                cleanupPositionAttributes: true,
              },
            );
          }
          if (
            CONTENT_TYPE.isTextual(urlInfo.contentType) &&
            urlInfo.referenceToOthersSet.size > 0
          ) {
            const containedPlaceholders = new Set();
            const contentWithPredictibleVersionPlaceholders =
              replaceWithDefaultAndPopulateContainedPlaceholders(
                content,
                containedPlaceholders,
              );
            content = contentWithPredictibleVersionPlaceholders;
          }
          const contentVersion = generateVersion([content]);
          contentOnlyVersionMap.set(urlInfo, contentVersion);
        });
      }

      generate_versions: {
        const getSetOfUrlInfoInfluencingVersion = (urlInfo) => {
          // there is no need to take into account dependencies
          // when the reference can reference them without version
          // (importmap or window.__v__)
          const setOfUrlInfluencingVersion = new Set();
          const visitDependencies = (urlInfo) => {
            urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (referenceVersionedExternallyMap.has(referenceToOther)) {
                // when versioning is dynamic no need to take into account
                // happens for:
                // - specifier mapped by window.__v__()
                // - specifier mapped by importmap
                return;
              }
              const referencedUrlInfo = referenceToOther.urlInfo;
              const referencedContentVersion =
                contentOnlyVersionMap.get(referencedUrlInfo);
              if (!referencedContentVersion) {
                // ignored while traversing graph (not used anymore, inline, ...)
                return;
              }
              if (setOfUrlInfluencingVersion.has(referencedUrlInfo)) {
                // handle circular deps
                return;
              }
              setOfUrlInfluencingVersion.add(referencedUrlInfo);
              visitDependencies(referencedUrlInfo);
            });
          };
          visitDependencies(urlInfo);
          return setOfUrlInfluencingVersion;
        };

        contentOnlyVersionMap.forEach((contentOnlyVersion, urlInfo) => {
          const setOfUrlInfoInfluencingVersion =
            getSetOfUrlInfoInfluencingVersion(urlInfo);
          const versionPartSet = new Set();
          versionPartSet.add(contentOnlyVersion);
          setOfUrlInfoInfluencingVersion.forEach(
            (urlInfoInfluencingVersion) => {
              const otherUrlInfoContentVersion = contentOnlyVersionMap.get(
                urlInfoInfluencingVersion,
              );
              if (!otherUrlInfoContentVersion) {
                throw new Error(
                  `cannot find content version for ${urlInfoInfluencingVersion.url} (used by ${urlInfo.url})`,
                );
              }
              versionPartSet.add(otherUrlInfoContentVersion);
            },
          );
          const version = generateVersion(versionPartSet);
          versionMap.set(urlInfo, version);
        });
      }

      replace_version_placeholders: {
        // now replace all placeholders in urlInfos with the real versions
        versionMap.forEach((version, urlInfo) => {
          if (!CONTENT_TYPE.isTextual(urlInfo.contentType)) return;
          if (urlInfo.referenceToOthersSet.size === 0) return;
          urlInfo.content = urlInfo.content.replace(
            REPLACER_REGEX,
            (placeholder) => {
              const reference = placeholderToReferenceMap.get(placeholder);
              const replacementForExternalVersioning =
                referenceVersionedExternallyMap.get(reference);
              if (replacementForExternalVersioning) {
                return replacementForExternalVersioning;
              }
              const version = versionMap.get(reference.urlInfo);
              return version;
            },
          );
        });
      }

      populate_build_versioned_map: {
        // - will be used by global and importmap registry
        // - will be used by build during "inject_urls_in_service_workers" and
        //   "resync_resource_hints"
        specifierVersionedInlineSet.forEach((buildSpecifier) => {
          const buildSpecifierPlaceholder =
            buildSpecifierPlaceholderMap.get(buildSpecifier);
          const urlInfo = getUrlInfoFromBuildSpecifier(buildSpecifier);
          const version = versionMap.get(urlInfo);
          const buildSpecifierVersioned = replaceFirstPlaceholder(
            buildSpecifierPlaceholder,
            version,
          );
          buildSpecifierVersionedMap.set(
            buildSpecifier,
            buildSpecifierVersioned,
          );
        });
      }

      inject_global_registry_and_importmap: {
        const actions = [];
        const visitors = [];
        if (specifierVersionedByCodeSet.size) {
          const versionMappingsNeeded = {};
          specifierVersionedByCodeSet.forEach((buildSpecifier) => {
            versionMappingsNeeded[buildSpecifier] =
              buildSpecifierVersionedMap.get(buildSpecifier);
          });
          visitors.push((urlInfo) => {
            if (urlInfo.isEntryPoint) {
              actions.push(async () => {
                await injectVersionMappingsAsGlobal({
                  kitchen: finalKitchen,
                  urlInfo,
                  versionMappings: versionMappingsNeeded,
                });
              });
            }
          });
        }
        if (specifierVersionedByImportmapSet.size) {
          const versionMappingsNeeded = {};
          specifierVersionedByImportmapSet.forEach((buildSpecifier) => {
            versionMappingsNeeded[buildSpecifier] =
              buildSpecifierVersionedMap.get(buildSpecifier);
          });
          visitors.push((urlInfo) => {
            if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
              actions.push(async () => {
                await injectVersionMappingsAsImportmap({
                  kitchen: finalKitchen,
                  urlInfo,
                  versionMappings: versionMappingsNeeded,
                });
              });
            }
          });
        }

        if (visitors.length) {
          GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
            if (urlInfo.isRoot) return;
            visitors.forEach((visitor) => visitor(urlInfo));
          });
          if (actions.length) {
            await Promise.all(actions.map((action) => action()));
          }
        }
      }
    },
    getVersion: (urlInfo) => versionMap.get(urlInfo),
    getBuildSpecifierVersioned: (buildSpecifier) =>
      buildSpecifierVersionedMap.get(buildSpecifier),
  };
};

const injectVersionPlaceholderIntoBuildSpecifier = ({
  buildSpecifier,
  versionPlaceholder,
  versioningMethod,
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParamIntoSpecifierWithoutEncoding(
      buildSpecifier,
      "v",
      versionPlaceholder,
    );
  }
  return renderUrlOrRelativeUrlFilename(
    buildSpecifier,
    ({ basename, extension }) => {
      return `${basename}-${versionPlaceholder}${extension}`;
    },
  );
};
