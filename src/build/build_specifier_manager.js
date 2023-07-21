import { createHash } from "node:crypto";
import { ANSI, createDetailedMessage } from "@jsenv/log";
import {
  ensurePathnameTrailingSlash,
  urlToRelativeUrl,
  injectQueryParamIntoSpecifierWithoutEncoding,
  renderUrlOrRelativeUrlFilename,
} from "@jsenv/urls";
import { parseHtmlString, stringifyHtmlAst } from "@jsenv/ast";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { isWebWorkerUrlInfo } from "../kitchen/web_workers.js";
import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import {
  injectVersionMappingsAsGlobal,
  injectVersionMappingsAsImportmap,
} from "./version_mappings_injection.js";

export const createBuildSpecifierManager = ({
  rawKitchen,
  finalKitchen,
  logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  base,
  assetsDirectory,
  length = 8,

  versioning,
  versioningMethod,
  versionLength,
  canUseImportmap,
}) => {
  const buildUrlsGenerator = createBuildUrlsGenerator({
    buildDirectoryUrl,
    assetsDirectory,
  });
  const placeholderAPI = createPlaceholderAPI({
    length,
  });
  const placeholderToReferenceMap = new Map();
  const urlInfoToBuildUrlMap = new Map();
  const buildUrlToBuildSpecifierMap = new Map();
  const generateReplacement = (reference) => {
    const generatedUrl = reference.generatedUrl;
    let urlInfo;
    const rawUrlInfo = rawKitchen.graph.getUrlInfo(reference.url);
    if (rawUrlInfo) {
      urlInfo = rawUrlInfo;
    } else {
      const buildUrlInfo = reference.urlInfo;
      buildUrlInfo.type = reference.expectedType || "asset";
      buildUrlInfo.subtype = reference.expectedSubtype;
      urlInfo = buildUrlInfo;
    }
    const buildUrl = buildUrlsGenerator.generate(generatedUrl, {
      urlInfo,
      ownerUrlInfo: reference.ownerUrlInfo,
    });
    logger.debug(`associate a build url
${ANSI.color(generatedUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
    `);

    let buildSpecifier;
    if (base === "./") {
      const parentUrl =
        reference.ownerUrlInfo.url === sourceDirectoryUrl
          ? buildDirectoryUrl
          : reference.ownerUrlInfo.url;
      const urlRelativeToParent = urlToRelativeUrl(buildUrl, parentUrl);
      if (urlRelativeToParent[0] === ".") {
        buildSpecifier = urlRelativeToParent;
      } else {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        buildSpecifier = `./${urlRelativeToParent}`;
      }
    } else {
      const urlRelativeToBuildDirectory = urlToRelativeUrl(
        buildUrl,
        buildDirectoryUrl,
      );
      buildSpecifier = `${base}${urlRelativeToBuildDirectory}`;
    }

    urlInfoToBuildUrlMap.set(reference.urlInfo, buildUrl);
    buildUrlToBuildSpecifierMap.set(buildUrl, buildSpecifier);
    const buildSpecifierFormatted = applyVersioningOnBuildSpecifier(
      buildSpecifier,
      reference,
    );
    return buildSpecifierFormatted;
  };
  const internalRedirections = new Map();
  const jsenvPlugin = {
    name: "build_directory",
    appliesDuring: "build",
    // reference resolution is split in 2
    // the redirection to build directory is done in a second phase (redirectReference)
    // to let opportunity to others plugins (js_module_fallback)
    // to mutate reference (inject ?js_module_fallback)
    // before it gets redirected to build directory
    resolveReference: (reference) => {
      const referenceFromPlaceholder = placeholderToReferenceMap.get(
        reference.specifier,
      );
      if (referenceFromPlaceholder) {
        return referenceFromPlaceholder.url;
      }
      if (reference.type === "filesystem") {
        const ownerRawUrl = ensurePathnameTrailingSlash(
          reference.ownerUrlInfo.url,
        );
        const url = new URL(reference.specifier, ownerRawUrl).href;
        return url;
      }
      if (reference.specifier[0] === "/") {
        const url = new URL(reference.specifier.slice(1), sourceDirectoryUrl)
          .href;
        return url;
      }
      if (reference.injected) {
        // js_module_fallback
        const url = new URL(
          reference.specifier,
          reference.baseUrl || reference.ownerUrlInfo.url,
        ).href;
        return url;
      }
      if (reference.isInline) {
        const rawInlineUrlInfo = GRAPH_VISITOR.find(
          rawKitchen.graph,
          (rawUrlInfoCandidate) => {
            const { inlineUrlSite } = rawUrlInfoCandidate;
            // not inline
            if (!inlineUrlSite) return false;
            if (
              inlineUrlSite.url === reference.ownerUrlInfo.originalUrl &&
              inlineUrlSite.line === reference.specifierLine &&
              inlineUrlSite.column === reference.specifierColumn
            ) {
              return true;
            }
            if (rawUrlInfoCandidate.content === reference.content) {
              return true;
            }
            if (rawUrlInfoCandidate.originalContent === reference.content) {
              return true;
            }
            return false;
          },
        );
        const url = rawInlineUrlInfo.url;
        return url;
      }
      const parentUrl = reference.baseUrl || reference.ownerUrlInfo.url;
      const url = new URL(reference.specifier, parentUrl).href;
      return url;
    },
    formatReference: (reference) => {
      const generatedUrl = reference.generatedUrl;
      if (!generatedUrl.startsWith("file:")) {
        return null;
      }
      if (reference.isWeak) {
        return null;
      }
      if (generatedUrl !== reference.url) {
        internalRedirections.set(reference.url, generatedUrl);
      }
      const placeholder = placeholderAPI.generate();
      placeholderToReferenceMap.set(placeholder, reference);
      return placeholder;
    },
    fetchUrlContent: async (finalUrlInfo) => {
      const { firstReference } = finalUrlInfo;

      // reference injected during "shape":
      // - "js_module_fallback" injecting a reference to url without "?js_module_fallback"
      // - "js_module_fallback" injecting "s.js"
      if (firstReference.injected) {
        const reference = firstReference.original || firstReference;
        const rawReference = rawKitchen.graph.rootUrlInfo.dependencies.inject({
          type: reference.type,
          expectedType: reference.expectedType,
          specifier: reference.specifier,
          specifierLine: reference.specifierLine,
          specifierColumn: reference.specifierColumn,
          specifierStart: reference.specifierStart,
          specifierEnd: reference.specifierEnd,
        });
        const rawUrlInfo = rawReference.urlInfo;
        await rawUrlInfo.cook();
        return {
          type: rawUrlInfo.type,
          content: rawUrlInfo.content,
          contentType: rawUrlInfo.contentType,
          originalContent: rawUrlInfo.originalContent,
          originalUrl: rawUrlInfo.originalUrl,
          sourcemap: rawUrlInfo.sourcemap,
        };
      }

      const rawUrl = firstReference.url;
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(firstReference.url);
      if (!rawUrlInfo) {
        throw new Error(createDetailedMessage(`Cannot find ${rawUrl}`));
      }
      if (rawUrlInfo.isInline) {
        // Inline content, such as <script> inside html, is transformed during the previous phase.
        // If we read the inline content it would be considered as the original content.
        // - It could be "fixed" by taking into account sourcemap and consider sourcemap sources
        //   as the original content.
        //   - But it would not work when sourcemap are not generated
        //   - would be a bit slower
        // - So instead of reading the inline content directly, we search into raw graph
        //   to get "originalContent" and "sourcemap"
        finalUrlInfo.type = rawUrlInfo.type;
        finalUrlInfo.subtype = rawUrlInfo.subtype;
      }
      return rawUrlInfo;
    },
  };

  const buildUrlToBuildSpecifierVersionedMap = new Map();

  const versionMap = new Map();

  const workerReferenceSet = new Set();
  const referenceVersioningInfoMap = new Map();
  const _getReferenceVersioningInfo = (reference) => {
    const ownerUrlInfo = reference.ownerUrlInfo;
    if (ownerUrlInfo.jsQuote) {
      // here we use placeholder as specifier, so something like
      // "/other/file.png" becomes "!~{0001}~" and finally "__v__("/other/file.png")"
      // this is to support cases like CSS inlined in JS
      // CSS minifier must see valid CSS specifiers like background-image: url("!~{0001}~");
      // that is finally replaced by invalid css background-image: url("__v__("/other/file.png")")
      return {
        type: "global",
        render: (buildSpecifier) => {
          return `${ownerUrlInfo.jsQuote}+__v__(${JSON.stringify(
            buildSpecifier,
          )})+${ownerUrlInfo.jsQuote}`;
        },
      };
    }
    if (reference.type === "js_url") {
      return {
        type: "global",
        render: (buildSpecifier) => {
          return `__v__(${JSON.stringify(buildSpecifier)})`;
        },
      };
    }
    if (reference.type === "js_import") {
      if (reference.subtype === "import_dynamic") {
        return {
          type: "global",
          render: (buildSpecifier) => {
            return `__v__(${JSON.stringify(buildSpecifier)})`;
          },
        };
      }
      if (reference.subtype === "import_meta_resolve") {
        return {
          type: "global",
          render: (buildSpecifier) => {
            return `__v__(${JSON.stringify(buildSpecifier)})`;
          },
        };
      }
      if (canUseImportmap && !isReferencedByWorker(reference)) {
        return {
          type: "importmap",
          render: (buildSpecifier) => {
            return buildSpecifier;
          },
        };
      }
    }
    return {
      type: "inline",
      render: (buildSpecifier) => {
        const buildSpecifierVersioned =
          buildUrlToBuildSpecifierVersionedMap.get(buildSpecifier);
        return buildSpecifierVersioned;
      },
    };
  };
  const getReferenceVersioningInfo = (reference) => {
    const infoFromCache = referenceVersioningInfoMap.get(reference);
    if (infoFromCache) {
      return infoFromCache;
    }
    const info = _getReferenceVersioningInfo(reference);
    referenceVersioningInfoMap.set(reference, info);
    return info;
  };
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

  const prepareVersioning = () => {
    const contentOnlyVersionMap = new Map();
    const urlInfoToContainedPlaceholderSetMap = new Map();
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
          const containedPlaceholderSet = new Set();
          if (
            CONTENT_TYPE.isTextual(urlInfo.contentType) &&
            urlInfo.referenceToOthersSet.size > 0
          ) {
            const contentWithPredictibleVersionPlaceholders =
              placeholderAPI.replaceWithDefaultAndPopulateContainedPlaceholderSet(
                content,
                containedPlaceholderSet,
              );
            content = contentWithPredictibleVersionPlaceholders;
          }
          urlInfoToContainedPlaceholderSetMap.set(
            urlInfo,
            containedPlaceholderSet,
          );
          const contentVersion = generateVersion([content], versionLength);
          contentOnlyVersionMap.set(urlInfo, contentVersion);
        },
      );
    }

    generate_versions: {
      const getSetOfUrlInfoInfluencingVersion = (urlInfo) => {
        const placeholderInfluencingVersionSet = new Set();
        const visitContainedPlaceholders = (urlInfo) => {
          const referencedContentVersion = contentOnlyVersionMap.get(urlInfo);
          if (!referencedContentVersion) {
            // ignored while traversing graph (not used anymore, inline, ...)
            return;
          }
          const containedPlaceholderSet =
            urlInfoToContainedPlaceholderSetMap.get(urlInfo);
          for (const containedPlaceholder of containedPlaceholderSet) {
            if (placeholderInfluencingVersionSet.has(containedPlaceholder)) {
              continue;
            }
            const reference =
              placeholderToReferenceMap.get(containedPlaceholder);
            const referenceVersioningInfo =
              getReferenceVersioningInfo(reference);
            if (
              referenceVersioningInfo.type === "global" ||
              referenceVersioningInfo.type === "importmap"
            ) {
              // when versioning is dynamic no need to take into account
              continue;
            }
            placeholderInfluencingVersionSet.add(containedPlaceholder);
            const referencedUrlInfo = reference.urlInfo;
            visitContainedPlaceholders(referencedUrlInfo);
          }
        };
        visitContainedPlaceholders(urlInfo);

        const setOfUrlInfluencingVersion = new Set();
        for (const placeholderInfluencingVersion of placeholderInfluencingVersionSet) {
          const reference = placeholderToReferenceMap.get(
            placeholderInfluencingVersion,
          );
          const referencedUrlInfo = reference.urlInfo;
          setOfUrlInfluencingVersion.add(referencedUrlInfo);
        }
        return setOfUrlInfluencingVersion;
      };

      contentOnlyVersionMap.forEach((contentOnlyVersion, urlInfo) => {
        const setOfUrlInfoInfluencingVersion =
          getSetOfUrlInfoInfluencingVersion(urlInfo);
        const versionPartSet = new Set();
        versionPartSet.add(contentOnlyVersion);
        setOfUrlInfoInfluencingVersion.forEach((urlInfoInfluencingVersion) => {
          const otherUrlInfoContentVersion = contentOnlyVersionMap.get(
            urlInfoInfluencingVersion,
          );
          if (!otherUrlInfoContentVersion) {
            throw new Error(
              `cannot find content version for ${urlInfoInfluencingVersion.url} (used by ${urlInfo.url})`,
            );
          }
          versionPartSet.add(otherUrlInfoContentVersion);
        });
        const version = generateVersion(versionPartSet, versionLength);
        versionMap.set(urlInfo, version);
      });
    }
  };

  const applyVersioningOnBuildSpecifier = (buildSpecifier, reference) => {
    if (!versioning || !shouldApplyVersioningOnReference(reference)) {
      return buildSpecifier;
    }
    const version = versionMap.get(reference.urlInfo);
    const buildSpecifierVersioned = injectVersionIntoBuildSpecifier({
      buildSpecifier,
      versioningMethod,
      version,
    });
    buildUrlToBuildSpecifierVersionedMap.set(
      buildSpecifier,
      buildSpecifierVersioned,
    );
    const referenceVersioningInfo = getReferenceVersioningInfo(reference);
    return referenceVersioningInfo.render(buildSpecifier);
  };
  const finishVersioning = async () => {
    inject_global_registry_and_importmap: {
      const actions = [];
      const visitors = [];
      const globalMappings = {};
      const importmapMappings = {};
      referenceVersioningInfoMap.forEach((versioningInfo, reference) => {
        if (versioningInfo.type === "global") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildUrlToBuildSpecifierVersionedMap.get(buildSpecifier);
          globalMappings[buildSpecifier] = buildSpecifierVersioned;
        }
        if (versioningInfo.type === "importmap") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildUrlToBuildSpecifierVersionedMap.get(buildSpecifier);
          importmapMappings[buildSpecifier] = buildSpecifierVersioned;
        }
      });
      if (Object.keys(globalMappings).length > 0) {
        visitors.push((urlInfo) => {
          if (urlInfo.isEntryPoint) {
            actions.push(async () => {
              await injectVersionMappingsAsGlobal(urlInfo, globalMappings);
            });
          }
        });
      }
      if (Object.keys(importmapMappings).length > 0) {
        visitors.push((urlInfo) => {
          if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
            actions.push(async () => {
              await injectVersionMappingsAsImportmap(
                urlInfo,
                importmapMappings,
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
  };

  return {
    jsenvPlugin,

    replacePlaceholders: async () => {
      if (versioning) {
        prepareVersioning();
      }

      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          if (urlInfo.isEntryPoint) {
            generateReplacement(urlInfo.firstReference);
          }
          if (urlInfo.isInline) {
            generateReplacement(urlInfo.firstReference);
          }
          const contentBeforeReplace = urlInfo.content;
          const contentAfterReplace = placeholderAPI.replaceAll(
            contentBeforeReplace,
            (placeholder) => {
              const reference = placeholderToReferenceMap.get(placeholder);
              return generateReplacement(reference);
            },
          );
          urlInfo.content = contentAfterReplace;
        },
      );

      if (versioning) {
        await finishVersioning();
      }
    },

    getBuildRelativeUrl: (urlInfo) => {
      const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
      const buildRelativeUrl = urlToRelativeUrl(buildUrl, buildDirectoryUrl);
      return buildRelativeUrl;
    },
  };
};

// see also "New hashing algorithm that "fixes (nearly) everything"
// at https://github.com/rollup/rollup/pull/4543
const placeholderLeft = "!~{";
const placeholderRight = "}~";
const placeholderOverhead = placeholderLeft.length + placeholderRight.length;

const createPlaceholderAPI = ({ length }) => {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
  const toBase64 = (value) => {
    let outString = "";
    do {
      const currentDigit = value % 64;
      value = (value / 64) | 0;
      outString = chars[currentDigit] + outString;
    } while (value !== 0);
    return outString;
  };

  let nextIndex = 0;
  const generate = () => {
    nextIndex++;
    const id = toBase64(nextIndex);
    let placeholder = placeholderLeft;
    placeholder += id.padStart(length - placeholderOverhead, "0");
    placeholder += placeholderRight;
    return placeholder;
  };

  const replaceFirst = (code, value) => {
    let replaced = false;
    return code.replace(PLACEHOLDER_REGEX, (match) => {
      if (replaced) return match;
      replaced = true;
      return value;
    });
  };

  const extractFirst = (string) => {
    const match = string.match(PLACEHOLDER_REGEX);
    return match ? match[0] : null;
  };

  const defaultPlaceholder = `${placeholderLeft}${"0".repeat(
    length - placeholderOverhead,
  )}${placeholderRight}`;
  const replaceWithDefaultAndPopulateContainedPlaceholderSet = (
    code,
    containedPlaceholderSet,
  ) => {
    const transformedCode = code.replace(PLACEHOLDER_REGEX, (placeholder) => {
      containedPlaceholderSet.add(placeholder);
      return defaultPlaceholder;
    });
    return transformedCode;
  };

  const PLACEHOLDER_REGEX = new RegExp(
    `${escapeRegexpSpecialChars(placeholderLeft)}[0-9a-zA-Z_$]{1,${
      length - placeholderOverhead
    }}${escapeRegexpSpecialChars(placeholderRight)}`,
    "g",
  );

  const replaceAll = (string, replacer) => {
    let diff = 0;
    let output = string;
    string.replace(PLACEHOLDER_REGEX, (placeholder, index) => {
      let replacement = replacer(placeholder, index);
      if (!replacement) {
        return;
      }
      if (typeof replacement === "string") {
        replacement = { valueType: "string", value: replacement };
      }
      const value = replacement.value;
      let start = index + diff;
      let end = start + placeholder.length;
      if (
        replacement.valueType === "code" &&
        // when specifier is wrapper by quotes
        // we remove the quotes to transform the string
        // into code that will be executed
        isWrappedByQuote(output, start, end)
      ) {
        start = start - 1;
        end = end + 1;
        diff = diff - 2;
      }
      const before = output.slice(0, start);
      const after = output.slice(end);
      output = before + value + after;
      const charAdded = value.length - placeholder.length;
      diff += charAdded;
    });
    return output;
  };

  return {
    generate,
    replaceFirst,
    replaceAll,
    extractFirst,
    replaceWithDefaultAndPopulateContainedPlaceholderSet,
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

const injectVersionIntoBuildSpecifier = ({
  buildSpecifier,
  version,
  versioningMethod,
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParamIntoSpecifierWithoutEncoding(
      buildSpecifier,
      "v",
      version,
    );
  }
  return renderUrlOrRelativeUrlFilename(
    buildSpecifier,
    ({ basename, extension }) => {
      return `${basename}-${version}${extension}`;
    },
  );
};

// const asBuildUrlVersioned = ({
//   buildSpecifierVersioned,
//   buildDirectoryUrl,
// }) => {
//   if (buildSpecifierVersioned[0] === "/") {
//     return new URL(buildSpecifierVersioned.slice(1), buildDirectoryUrl).href;
//   }
//   const buildUrl = new URL(buildSpecifierVersioned, buildDirectoryUrl).href;
//   if (buildUrl.startsWith(buildDirectoryUrl)) {
//     return buildUrl;
//   }
//   // it's likely "base" parameter was set to an url origin like "https://cdn.example.com"
//   // let's move url to build directory
//   const { pathname, search, hash } = new URL(buildSpecifierVersioned);
//   return `${buildDirectoryUrl}${pathname}${search}${hash}`;
// };
