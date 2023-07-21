import { ANSI, createDetailedMessage } from "@jsenv/log";
import { ensurePathnameTrailingSlash, urlToRelativeUrl } from "@jsenv/urls";

import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { createBuildVersionsManager } from "./build_versions_manager.js";

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

  const buildSpecifierToBuildUrlMap = new Map();
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

    buildSpecifierToBuildUrlMap.set(buildSpecifier, buildUrl);
    urlInfoToBuildUrlMap.set(reference.urlInfo, buildUrl);
    return {
      valueType: "specifier",
      value: buildSpecifier,
    };
  };

  const getBuildUrlFromBuildSpecifier = (buildSpecifier) => {
    return findKey(buildSpecifierToBuildUrlMap, buildSpecifier);
  };

  const buildVersionsManager = createBuildVersionsManager({
    finalKitchen,
    versioning,
    versioningMethod,
    versionLength,
    canUseImportmap,
    getBuildUrlFromBuildSpecifier: (buildSpecifier) =>
      getBuildUrlFromBuildSpecifier(buildSpecifier),
  });

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

  return {
    buildVersionsManager,
    jsenvPlugin,

    replacePlaceholders: () => {
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
    },
    getBuildRelativeUrl: (urlInfo) => {
      const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
      const buildRelativeUrl = urlToRelativeUrl(buildUrl, buildDirectoryUrl);
      return buildRelativeUrl;
    },
  };
};

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
    replaceWithDefaultAndPopulateContainedPlaceholders,
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

const findKey = (map, value) => {
  for (const [keyCandidate, valueCandidate] of map) {
    if (valueCandidate === value) {
      return keyCandidate;
    }
  }
  return undefined;
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
