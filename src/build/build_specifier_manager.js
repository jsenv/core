import { ANSI, createDetailedMessage } from "@jsenv/log";
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  ensurePathnameTrailingSlash,
  asUrlWithoutSearch,
} from "@jsenv/urls";

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
  const generateBuildUrlForSourceFile = ({ url, rawUrlInfo, reference }) => {
    const urlObject = new URL(url);
    urlObject.searchParams.delete("as_js_classic");
    urlObject.searchParams.delete("as_json_module");
    const sourceUrl = urlObject.href;

    const buildUrlFromCache = sourceRedirections.get(sourceUrl);
    if (buildUrlFromCache) {
      return buildUrlFromCache;
    }
    const buildUrl = buildUrlsGenerator.generate(url, {
      urlInfo: rawUrlInfo,
      ownerUrlInfo: reference.ownerUrlInfo,
    });
    sourceRedirections.set(sourceUrl, buildUrl);
    logger.debug(`generate build url for source file
${ANSI.color(url, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
    return buildUrl;
  };
  const getSourceUrl = (buildUrl) => {
    return findKey(sourceRedirections, buildUrl);
  };
  const buildRedirections = new Map();
  const generateBuildUrlForBuildFile = ({ url, reference }) => {
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
        const rawUrlInfo = rawKitchen.graph.getUrlInfo(
          urlInfoBundled.originalUrl,
        );
        rawUrlInfo.data.bundled = false;
        bundleRedirections.set(urlInfoBundled.originalUrl, buildUrl);
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
  const asFormattedBuildSpecifier = (reference) => {
    if (base === "./") {
      const parentUrl =
        reference.ownerUrlInfo.url === sourceDirectoryUrl
          ? buildDirectoryUrl
          : reference.ownerUrlInfo.url;
      const urlRelativeToParent = urlToRelativeUrl(reference.url, parentUrl);
      if (urlRelativeToParent[0] !== ".") {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        return `./${urlRelativeToParent}`;
      }
      return urlRelativeToParent;
    }
    const urlRelativeToBuildDirectory = urlToRelativeUrl(
      reference.url,
      buildDirectoryUrl,
    );
    return `${base}${urlRelativeToBuildDirectory}`;
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

  const getBuildRelativeUrl = (url) => {
    const urlObject = new URL(url);
    urlObject.searchParams.delete("js_module_fallback");
    urlObject.searchParams.delete("as_css_module");
    urlObject.searchParams.delete("as_json_module");
    urlObject.searchParams.delete("as_text_module");
    url = urlObject.href;
    const buildRelativeUrl = urlToRelativeUrl(url, buildDirectoryUrl);
    return buildRelativeUrl;
  };

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
    resolveReference: (reference) => {
      let url;
      if (reference.type === "filesystem") {
        let ownerRawUrl = buildRedirections.get(reference.ownerUrlInfo.url);
        ownerRawUrl = ensurePathnameTrailingSlash(ownerRawUrl);
        url = new URL(reference.specifier, ownerRawUrl).href;
      } else if (reference.specifier[0] === "/") {
        url = new URL(reference.specifier.slice(1), sourceDirectoryUrl).href;
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
      // source file -> redirect to build directory
      if (urlIsInsideOf(url, sourceDirectoryUrl)) {
        const rawUrlInfo = rawKitchen.graph.getUrlInfo(url);
        if (rawUrlInfo) {
          const buildUrl = generateBuildUrlForSourceFile({
            url,
            reference,
            rawUrlInfo,
          });
          return buildUrl;
        }
        throw new Error(`There is no source file for "${url}"`);
      }
      // build file -> ...
      if (urlIsInsideOf(url, buildDirectoryUrl)) {
        // generated during "shape"
        // - sourcemaps
        // - "js_module_fallback" injecting "s.js"
        // - ??
        const buildUrl = generateBuildUrlForBuildFile({ url, reference });
        return buildUrl;
      }
      throw new Error("wtf");
    },
    formatReference: (reference) => {
      if (!reference.generatedUrl.startsWith("file:")) {
        return null;
      }
      if (reference.isWeak) {
        return null;
      }
      if (!urlIsInsideOf(reference.generatedUrl, buildDirectoryUrl)) {
        throw new Error(
          `urls should be inside build directory at this stage, found "${reference.url}"`,
        );
      }
      const buildSpecifier = asFormattedBuildSpecifier(reference);
      buildSpecifierToBuildUrlMap.set(buildSpecifier, reference.url);
      const buildSpecifierWithVersionPlaceholder =
        buildVersionsManager.generateBuildSpecifierPlaceholder(
          reference,
          buildSpecifier,
        );
      return buildSpecifierWithVersionPlaceholder;
    },
    fetchUrlContent: async (finalUrlInfo) => {
      const { firstReference } = finalUrlInfo;
      // .original reference updated during "shape":
      // happens for "js_module_fallback"
      const reference = firstReference.original || firstReference;
      // reference injected during "shape":
      // - happens for "js_module_fallback" injecting "s.js"
      if (reference.injected) {
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
      const url = reference.url;
      const rawUrl = getSourceUrl(url);
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
      if (!rawUrlInfo) {
        throw new Error(createDetailedMessage(`Cannot find ${url}`));
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
      return getBuildRelativeUrl(urlInfo.url);
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
