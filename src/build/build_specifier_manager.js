import { ANSI, createDetailedMessage } from "@jsenv/log";
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  ensurePathnameTrailingSlash,
  asUrlWithoutSearch,
} from "@jsenv/urls";

import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { isWebWorkerEntryPointReference } from "../kitchen/web_workers.js";
import { createBuildVersionsManager } from "./build_versions_manager.js";

export const createBuildSpecifierManager = ({
  rawKitchen,
  finalKitchen,
  logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  base,
  assetsDirectory,

  versioning,
  versioningMethod,
  versionLength,
  canUseImportmap,
}) => {
  const buildUrlsGenerator = createBuildUrlsGenerator({
    buildDirectoryUrl,
    assetsDirectory,
  });
  const sourceRedirections = new Map();
  const generateBuildUrlForSourceFile = ({ reference, rawUrlInfo }) => {
    const url = reference.generatedUrl;
    const buildUrlFromCache = sourceRedirections.get(url);
    if (buildUrlFromCache) {
      return buildUrlFromCache;
    }
    const buildUrl = buildUrlsGenerator.generate(url, {
      urlInfo: rawUrlInfo,
      ownerUrlInfo: reference.ownerUrlInfo,
    });
    sourceRedirections.set(url, buildUrl);
    logger.debug(`generate build url for source file
${ANSI.color(url, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
    return buildUrl;
  };
  // const getSourceUrl = (buildUrl) => {
  //   return findKey(sourceRedirections, buildUrl);
  // };
  const buildRedirections = new Map();
  const generateBuildUrlForBuildFile = ({ reference }) => {
    const url = reference.url;
    const buildUrlFromCache = buildRedirections.get(url);
    if (buildUrlFromCache) {
      return buildUrlFromCache;
    }
    const buildUrl = buildUrlsGenerator.generate(url, {
      urlInfo: {
        data: {},
        type: reference.expectedType || "asset",
      },
      ownerUrlInfo: reference.ownerUrlInfo,
    });
    buildRedirections.set(url, buildUrl);
    logger.debug(`generate build url for build file
${ANSI.color(url, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
    return buildUrl;
  };
  const bundleRedirections = new Map();
  const bundleInternalRedirections = new Map();
  const bundleUrlInfos = {};
  const generateBuildUrlForBundle = ({ url, urlInfoBundled }) => {
    const buildUrl = buildUrlsGenerator.generate(url, {
      urlInfo: urlInfoBundled,
    });
    bundleRedirections.set(url, buildUrl);
    if (urlIsInsideOf(url, buildDirectoryUrl)) {
      if (urlInfoBundled.data.isDynamicEntry) {
        const rawUrl = urlInfoBundled.originalUrl;
        const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
        rawUrlInfo.data.bundled = false;
        bundleRedirections.set(rawUrl, buildUrl);
      } else {
        urlInfoBundled.data.generatedToShareCode = true;
      }
    }
    if (urlInfoBundled.data.bundleRelativeUrl) {
      const urlForBundler = new URL(
        urlInfoBundled.data.bundleRelativeUrl,
        buildDirectoryUrl,
      ).href;
      if (urlForBundler !== buildUrl) {
        bundleInternalRedirections.set(urlForBundler, buildUrl);
      }
    }

    bundleUrlInfos[buildUrl] = urlInfoBundled;
    if (buildUrl.includes("?")) {
      bundleUrlInfos[asUrlWithoutSearch(buildUrl)] = urlInfoBundled;
    }
  };

  const buildSpecifierToBuildUrlMap = new Map();

  const finalRedirections = new Map();

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

  const getFinalBuildUrl = (buildUrl) => {
    const urlAfterBundling = bundleRedirections.get(buildUrl);
    buildUrl = urlAfterBundling || buildUrl;
    buildUrl = bundleInternalRedirections.get(buildUrl) || buildUrl;
    buildUrl = finalRedirections.get(buildUrl) || buildUrl;
    return buildUrl;
  };

  const getBuildUrlBeforeFinalRedirect = (buildUrl) => {
    return findKey(finalRedirections, buildUrl);
  };

  const jsenvPlugin = {
    name: "build_directory",
    appliesDuring: "build",
    // reference resolution is split in 2
    // the redirection to build directory is done in a second phase (redirectReference)
    // to let opportunity to others plugins (js_module_fallback)
    // to mutate reference (inject ?js_module_fallback)
    // before it gets redirected to build directory
    resolveReference: (reference) => {
      let url;
      if (reference.type === "filesystem") {
        let ownerRawUrl = buildRedirections.get(reference.ownerUrlInfo.url);
        ownerRawUrl = ensurePathnameTrailingSlash(ownerRawUrl);
        url = new URL(reference.specifier, ownerRawUrl).href;
      } else if (reference.specifier[0] === "/") {
        url = new URL(reference.specifier.slice(1), sourceDirectoryUrl).href;
      } else if (reference.injected) {
        // js_module_fallback
        url = new URL(
          reference.specifier,
          reference.baseUrl || reference.ownerUrlInfo.url,
        ).href;
      } else if (reference.isInline) {
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
        url = rawInlineUrlInfo.url;
      } else {
        const parentUrl = reference.baseUrl || reference.ownerUrlInfo.url;
        const parentUrlRaw = buildRedirections.get(parentUrl);
        url = new URL(reference.specifier, parentUrlRaw).href;
      }
      if (!url.startsWith("file:")) {
        return url;
      }
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

      // source file -> redirect to build directory
      let buildUrl;
      if (urlIsInsideOf(generatedUrl, sourceDirectoryUrl)) {
        if (reference.original) {
          // jsenv_plugin_js_module_fallback injects "?js_module_fallback"
          // during "shape" step
          // Consequently there is no urlInfo into source graph generated during "craft"
          // We are create a fake one to produce a valid build url
          const rawUrlInfo = {
            data: reference.data,
            isEntryPoint:
              reference.isEntryPoint ||
              isWebWorkerEntryPointReference(reference),
            type: reference.expectedType,
            subtype: reference.expectedSubtype,
            filename: reference.filename,
          };
          buildUrl = generateBuildUrlForSourceFile({
            reference,
            rawUrlInfo,
          });
        } else {
          const rawUrlInfo = rawKitchen.graph.getUrlInfo(reference.url);
          if (!rawUrlInfo) {
            throw new Error(`There is no source file for "${reference.url}"`);
          }
          buildUrl = generateBuildUrlForSourceFile({
            reference,
            rawUrlInfo,
          });
        }
      } else {
        // generated during "shape"
        // - sourcemaps
        // - "js_module_fallback" injecting "s.js"
        // - ??
        buildUrl = generateBuildUrlForBuildFile({ reference });
      }

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
      const buildSpecifierWithVersionPlaceholder =
        buildVersionsManager.generateBuildSpecifierPlaceholder(
          reference,
          buildSpecifier,
        );
      return buildSpecifierWithVersionPlaceholder;
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
        await rawReference.urlInfo.cook();
        return {
          type: rawReference.urlInfo.type,
          content: rawReference.urlInfo.content,
          contentType: rawReference.urlInfo.contentType,
          originalContent: rawReference.urlInfo.originalContent,
          originalUrl: rawReference.urlInfo.originalUrl,
          sourcemap: rawReference.urlInfo.sourcemap,
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

    generateBuildUrlForBundle,

    getFinalBuildUrl,
    getBuildUrlBeforeFinalRedirect,
    getBuildRelativeUrl: (urlInfo) => {
      if (versioning && versioningMethod === "filename") {
        const buildSpecifier = getBuildUrlFromBuildSpecifier(urlInfo.url);
        const buildSpecifierVersioned =
          buildVersionsManager.getBuildSpecifierVersioned(buildSpecifier);
        const buildUrlVersioned = asBuildUrlVersioned({
          buildSpecifierVersioned,
          buildDirectoryUrl,
        });
        const buildRelativeUrlVersioned = urlToRelativeUrl(
          buildUrlVersioned,
          buildDirectoryUrl,
        );
        return buildRelativeUrlVersioned;
      }
      const sourceUrl = urlInfo.url;
      const buildUrl = sourceRedirections.get(sourceUrl);
      const buildRelativeUrl = urlToRelativeUrl(buildUrl, buildDirectoryUrl);
      return buildRelativeUrl;
    },
  };
};

const findKey = (map, value) => {
  for (const [keyCandidate, valueCandidate] of map) {
    if (valueCandidate === value) {
      return keyCandidate;
    }
  }
  return undefined;
};

const asBuildUrlVersioned = ({
  buildSpecifierVersioned,
  buildDirectoryUrl,
}) => {
  if (buildSpecifierVersioned[0] === "/") {
    return new URL(buildSpecifierVersioned.slice(1), buildDirectoryUrl).href;
  }
  const buildUrl = new URL(buildSpecifierVersioned, buildDirectoryUrl).href;
  if (buildUrl.startsWith(buildDirectoryUrl)) {
    return buildUrl;
  }
  // it's likely "base" parameter was set to an url origin like "https://cdn.example.com"
  // let's move url to build directory
  const { pathname, search, hash } = new URL(buildSpecifierVersioned);
  return `${buildDirectoryUrl}${pathname}${search}${hash}`;
};
