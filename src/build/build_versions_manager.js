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
  versioning,
  versioningMethod,
  versionLength = 8,
  canUseImportmap,
  getBuildUrlFromBuildSpecifier,
}) => {
  const workerReferenceSet = new Set();
  const isReferencedByWorker = (reference) => {
    if (workerReferenceSet.has(reference)) {
      return true;
    }
    const referencedUrlInfo = reference.urlInfo;
    const dependentWorker = GRAPH_VISITOR.findDependent(
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
    return code.replace(PLACEHOLDER_REGEX, (match) => {
      if (replaced) return match;
      replaced = true;
      return value;
    });
  };

  const extractFirstPlaceholder = (string) => {
    const match = string.match(PLACEHOLDER_REGEX);
    return match ? match[0] : null;
  };

  const defaultPlaceholder = `${placeholderLeft}${"0".repeat(
    versionLength - placeholderOverhead,
  )}${placeholderRight}`;
  const replaceWithDefaultAndPopulateContainedPlaceholders = (
    code,
    containedPlaceholders,
  ) => {
    const transformedCode = code.replace(PLACEHOLDER_REGEX, (placeholder) => {
      containedPlaceholders.add(placeholder);
      return defaultPlaceholder;
    });
    return transformedCode;
  };

  const PLACEHOLDER_REGEX = new RegExp(
    `${escapeRegexpSpecialChars(placeholderLeft)}[0-9a-zA-Z_$]{1,${
      versionLength - placeholderOverhead
    }}${escapeRegexpSpecialChars(placeholderRight)}`,
    "g",
  );

  const placeholderToReferenceMap = new Map();
  const buildSpecifierToPlaceholderMap = new Map();

  const referenceVersionedByCodeMap = new Map();
  const referenceVersionedByImportmapMap = new Map();
  const specifierVersionedInlineSet = new Set();
  const specifierVersionedByCodeSet = new Set();
  const specifierVersionedByImportmapSet = new Set();
  const versionMap = new Map();

  const buildSpecifierToBuildSpecifierVersionedMap = new Map();
  // - will be used by global and importmap registry
  // - will be used by build during "inject_urls_in_service_workers" and
  //   "resync_resource_hints"
  const getBuildSpecifierVersioned = (buildSpecifier) => {
    const fromCache =
      buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
    if (fromCache) {
      return fromCache;
    }
    const buildSpecifierPlaceholder =
      buildSpecifierToPlaceholderMap.get(buildSpecifier);
    if (!buildSpecifierPlaceholder) {
      return null;
    }
    const buildUrl = getBuildUrlFromBuildSpecifier(buildSpecifier);
    const urlInfo = finalKitchen.graph.getUrlInfo(buildUrl);
    const version = versionMap.get(urlInfo);
    const buildSpecifierVersioned = replaceFirstPlaceholder(
      buildSpecifierPlaceholder,
      version,
    );
    buildSpecifierToBuildSpecifierVersionedMap.set(
      buildSpecifier,
      buildSpecifierVersioned,
    );
    return buildSpecifierVersioned;
  };

  const canUseVersionedUrl = (urlInfo) => {
    if (urlInfo.isRoot) {
      return false;
    }
    if (urlInfo.isEntryPoint) {
      return false;
    }
    return urlInfo.type !== "webmanifest";
  };

  const shouldApplyVersioningOnReference = (reference) => {
    if (reference.isInline) {
      return false;
    }
    if (reference.next && reference.next.isInline) {
      return false;
    }
    // specifier comes from "normalize" hook done a bit earlier in this file
    // we want to get back their build url to access their infos
    const referencedUrlInfo = reference.urlInfo;
    if (!canUseVersionedUrl(referencedUrlInfo)) {
      return false;
    }
    if (referencedUrlInfo.type === "sourcemap") {
      return false;
    }
    return true;
  };

  return {
    generateBuildSpecifierPlaceholder: (reference, buildSpecifier) => {
      if (!versioning || !shouldApplyVersioningOnReference(reference)) {
        return buildSpecifier;
      }

      const placeholder = generatePlaceholder();
      const buildSpecifierWithVersionPlaceholder =
        injectVersionPlaceholderIntoBuildSpecifier({
          buildSpecifier,
          versionPlaceholder: placeholder,
          versioningMethod,
        });
      buildSpecifierToPlaceholderMap.set(
        buildSpecifier,
        buildSpecifierWithVersionPlaceholder,
      );
      placeholderToReferenceMap.set(placeholder, reference);

      const asPlaceholderForVersionedSpecifier = () => {
        specifierVersionedInlineSet.add(buildSpecifier);
        return buildSpecifierWithVersionPlaceholder;
      };

      const asPlaceholderForCodeVersionedByGlobalRegistry = (codeToInject) => {
        // here we use placeholder as specifier, so something like
        // "/other/file.png" becomes "!~{0001}~" and finally "__v__("/other/file.png")"
        // this is to support cases like CSS inlined in JS
        // CSS minifier must see valid CSS specifiers like background-image: url("!~{0001}~");
        // that is finally replaced by invalid css background-image: url("__v__("/other/file.png")")
        specifierVersionedByCodeSet.add(buildSpecifier);
        referenceVersionedByCodeMap.set(reference, codeToInject);
        return placeholder;
      };

      const asPlaceholderForSpecifierVersionedByImportmap = (
        specifierToUse,
      ) => {
        specifierVersionedByImportmapSet.add(buildSpecifier);
        referenceVersionedByImportmapMap.set(reference, specifierToUse);
        return buildSpecifier;
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
        if (canUseImportmap() && !isReferencedByWorker(reference)) {
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
        GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
          finalKitchen.graph.rootUrlInfo,
          (urlInfo) => {
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
            const contentVersion = generateVersion([content], versionLength);
            contentOnlyVersionMap.set(urlInfo, contentVersion);
          },
        );
      }

      generate_versions: {
        const getSetOfUrlInfoInfluencingVersion = (urlInfo) => {
          // there is no need to take into account dependencies
          // when the reference can reference them without version
          // (importmap or window.__v__)
          const setOfUrlInfluencingVersion = new Set();
          const visitDependencies = (urlInfo) => {
            urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (
                referenceVersionedByCodeMap.has(referenceToOther) ||
                referenceVersionedByImportmapMap.has(referenceToOther)
              ) {
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
          const version = generateVersion(versionPartSet, versionLength);
          versionMap.set(urlInfo, version);
        });
      }

      replace_version_placeholders: {
        // now replace all placeholders in urlInfos with the real versions
        versionMap.forEach((version, urlInfo) => {
          if (!CONTENT_TYPE.isTextual(urlInfo.contentType)) return;
          if (urlInfo.referenceToOthersSet.size === 0) return;

          let replacements = [];
          let content = urlInfo.content;
          content.replace(PLACEHOLDER_REGEX, (placeholder, index) => {
            const replacement = {
              start: index,
              placeholder,
              value: null,
              valueType: "",
            };
            replacements.push(replacement);
            const reference = placeholderToReferenceMap.get(placeholder);

            const codeToInject = referenceVersionedByCodeMap.get(reference);
            if (codeToInject) {
              replacement.value = codeToInject;
              replacement.valueType = "code";
              return;
            }
            const specifierToUse =
              referenceVersionedByImportmapMap.get(reference);
            if (specifierToUse) {
              replacement.value = specifierToUse;
              replacement.valueType = "specifier";
              return;
            }
            const version = versionMap.get(reference.urlInfo);
            replacement.value = version;
            replacement.valueType = "specifier";
          });

          let diff = 0;
          replacements.forEach((replacement) => {
            const placeholder = replacement.placeholder;
            const value = replacement.value;
            let start = replacement.start + diff;
            let end = start + placeholder.length;
            if (
              replacement.valueType === "code" &&
              // when specifier is wrapper by quotes
              // we remove the quotes to transform the string
              // into code that will be executed
              isWrappedByQuote(content, start, end)
            ) {
              start = start - 1;
              end = end + 1;
              diff = diff - 2;
            }
            const before = content.slice(0, start);
            const after = content.slice(end);
            content = before + value + after;
            const charAdded = value.length - placeholder.length;
            diff += charAdded;
          });
          urlInfo.content = content;
        });
      }

      inject_global_registry_and_importmap: {
        const actions = [];
        const visitors = [];
        if (specifierVersionedByCodeSet.size) {
          const versionMappingsNeeded = {};
          specifierVersionedByCodeSet.forEach((buildSpecifier) => {
            versionMappingsNeeded[buildSpecifier] =
              getBuildSpecifierVersioned(buildSpecifier);
          });
          visitors.push((urlInfo) => {
            if (urlInfo.isEntryPoint) {
              actions.push(async () => {
                await injectVersionMappingsAsGlobal(
                  urlInfo,
                  versionMappingsNeeded,
                );
              });
            }
          });
        }
        if (specifierVersionedByImportmapSet.size) {
          const versionMappingsNeeded = {};
          specifierVersionedByImportmapSet.forEach((buildSpecifier) => {
            versionMappingsNeeded[buildSpecifier] =
              getBuildSpecifierVersioned(buildSpecifier);
          });
          visitors.push((urlInfo) => {
            if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
              actions.push(async () => {
                await injectVersionMappingsAsImportmap(
                  urlInfo,
                  versionMappingsNeeded,
                );
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
    getBuildUrl: (reference) => {
      const { specifier } = reference;
      let referenceWithoutPlaceholder =
        placeholderToReferenceMap.get(specifier);
      if (!referenceWithoutPlaceholder) {
        const placeholder = extractFirstPlaceholder(specifier);
        if (placeholder) {
          referenceWithoutPlaceholder =
            placeholderToReferenceMap.get(placeholder);
        }
      }
      if (referenceWithoutPlaceholder) {
        return referenceWithoutPlaceholder.url;
      }
      return null;
    },
    canUseVersionedUrl,
    getVersion: (urlInfo) => versionMap.get(urlInfo),
    getBuildSpecifierVersioned,
  };
};

const isWrappedByQuote = (content, start, end) => {
  const previousChar = content[start - 1];
  const nextChar = content[end];
  if (previousChar === `'` && nextChar === `'`) {
    return true;
  }
  if (previousChar === `"` && nextChar === `"`) {
    return true;
  }
  if (previousChar === "`" && nextChar === "`") {
    return true;
  }
  return false;
};

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
const generateVersion = (parts, length) => {
  const hash = createHash("sha256");
  parts.forEach((part) => {
    hash.update(part);
  });
  return hash.digest("hex").slice(0, length);
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

// unit test exports
export { generateVersion };
