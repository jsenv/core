import { ANSI, createDetailedMessage } from "@jsenv/log";
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  ensurePathnameTrailingSlash,
  asUrlWithoutSearch,
} from "@jsenv/urls";
import { generateSourcemapFileUrl } from "@jsenv/sourcemap";

import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import { isWebWorkerEntryPointReference } from "../kitchen/web_workers.js";
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
  const buildSpecifierToBuildUrlMap = new Map();
  const bundleRedirections = new Map();
  const bundleInternalRedirections = new Map();
  const finalRedirections = new Map();
  const buildDirectoryRedirections = new Map();
  const associateBuildUrlAndRawUrl = (buildUrl, rawUrl, reason) => {
    if (urlIsInsideOf(rawUrl, buildDirectoryUrl)) {
      throw new Error(`raw url must be inside rawGraph, got ${rawUrl}`);
    }
    if (buildDirectoryRedirections.get(buildUrl) !== rawUrl) {
      logger.debug(`build url generated (${reason})
${ANSI.color(rawUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
      buildDirectoryRedirections.set(buildUrl, rawUrl);
    }
  };
  const getBuildUrlFromBuildSpecifier = (buildSpecifier) => {
    return findKey(buildSpecifierToBuildUrlMap, buildSpecifier);
  };
  const asFormattedBuildSpecifier = (reference, generatedUrl) => {
    if (base === "./") {
      const parentUrl =
        reference.ownerUrlInfo.url === sourceDirectoryUrl
          ? buildDirectoryUrl
          : reference.ownerUrlInfo.url;
      const urlRelativeToParent = urlToRelativeUrl(generatedUrl, parentUrl);
      if (urlRelativeToParent[0] !== ".") {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        return `./${urlRelativeToParent}`;
      }
      return urlRelativeToParent;
    }
    const urlRelativeToBuildDirectory = urlToRelativeUrl(
      generatedUrl,
      buildDirectoryUrl,
    );
    return `${base}${urlRelativeToBuildDirectory}`;
  };

  const buildUrlsGenerator = createBuildUrlsGenerator({
    buildDirectoryUrl,
    assetsDirectory,
  });
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

  const getRawUrl = (url) => {
    return buildDirectoryRedirections.get(url);
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

  const bundleUrlInfos = {};
  const jsenvPlugin = {
    name: "build_directory",
    appliesDuring: "build",
    resolveReference: (reference) => {
      const getUrl = () => {
        const buildUrl = buildVersionsManager.getBuildUrl(reference);
        if (buildUrl) {
          return buildUrl;
        }
        if (reference.type === "filesystem") {
          const ownerRawUrl = getRawUrl(reference.ownerUrlInfo.url);
          const ownerUrl = ensurePathnameTrailingSlash(ownerRawUrl);
          return new URL(reference.specifier, ownerUrl).href;
        }
        if (reference.specifier[0] === "/") {
          return new URL(reference.specifier.slice(1), buildDirectoryUrl).href;
        }
        return new URL(
          reference.specifier,
          reference.baseUrl || reference.ownerUrlInfo.url,
        ).href;
      };
      let url = getUrl();
      //  url = rawRedirections.get(url) || url
      url = getFinalBuildUrl(url);
      return url;
    },
    redirectReference: (reference) => {
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      // referenced by resource hint
      // -> keep it untouched, it will be handled by "resync_resource_hints"
      if (reference.isResourceHint) {
        return reference.original ? reference.original.url : null;
      }
      // already a build url
      const rawUrl = buildDirectoryRedirections.get(reference.url);
      if (rawUrl) {
        return reference.url;
      }
      if (reference.isInline) {
        const ownerFinalUrlInfo = finalKitchen.graph.getUrlInfo(
          reference.ownerUrlInfo.url,
        );
        const ownerRawUrl = ownerFinalUrlInfo.originalUrl;
        const rawUrlInfo = GRAPH_VISITOR.find(
          rawKitchen.graph,
          (rawUrlInfo) => {
            const { inlineUrlSite } = rawUrlInfo;
            // not inline
            if (!inlineUrlSite) return false;
            if (
              inlineUrlSite.url === ownerRawUrl &&
              inlineUrlSite.line === reference.specifierLine &&
              inlineUrlSite.column === reference.specifierColumn
            ) {
              return true;
            }
            if (rawUrlInfo.content === reference.content) {
              return true;
            }
            if (rawUrlInfo.originalContent === reference.content) {
              return true;
            }
            return false;
          },
        );

        if (!rawUrlInfo) {
          // generated during final graph
          // (happens for JSON.parse injected for import assertions for instance)
          // throw new Error(`cannot find raw url for "${reference.url}"`)
          return reference.url;
        }
        const buildUrl = buildUrlsGenerator.generate(reference.url, {
          urlInfo: rawUrlInfo,
          ownerUrlInfo: ownerFinalUrlInfo,
        });
        associateBuildUrlAndRawUrl(buildUrl, rawUrlInfo.url, "inline content");
        return buildUrl;
      }
      // from "js_module_fallback":
      //   - injecting "?js_module_fallback" for the first time
      //   - injecting "?js_module_fallback" because the parentUrl has it
      if (reference.original) {
        const urlBeforeRedirect = reference.original.url;
        const urlAfterRedirect = reference.url;
        const isEntryPoint =
          reference.isEntryPoint || isWebWorkerEntryPointReference(reference);
        // the url info do not exists yet (it will be created after this "redirectReference" hook)
        // And the content will be generated when url is cooked by url graph loader.
        // Here we just want to reserve an url for that file
        const urlInfo = {
          data: reference.data,
          isEntryPoint,
          type: reference.expectedType,
          subtype: reference.expectedSubtype,
          filename: reference.filename,
        };
        if (urlIsInsideOf(urlBeforeRedirect, buildDirectoryUrl)) {
          // the redirection happened on a build url, happens due to:
          // 1. bundling
          const buildUrl = buildUrlsGenerator.generate(urlAfterRedirect, {
            urlInfo,
          });
          finalRedirections.set(urlBeforeRedirect, buildUrl);
          return buildUrl;
        }
        const rawUrl = urlAfterRedirect;
        const buildUrl = buildUrlsGenerator.generate(rawUrl, {
          urlInfo,
        });
        finalRedirections.set(urlBeforeRedirect, buildUrl);
        associateBuildUrlAndRawUrl(
          buildUrl,
          rawUrl,
          "redirected during postbuild",
        );
        return buildUrl;
      }
      // from "js_module_fallback":
      // - to inject "s.js"
      if (reference.injected) {
        const buildUrl = buildUrlsGenerator.generate(reference.url, {
          urlInfo: {
            data: {},
            type: "js_classic",
          },
        });
        associateBuildUrlAndRawUrl(
          buildUrl,
          reference.url,
          "injected during postbuild",
        );
        finalRedirections.set(buildUrl, buildUrl);
        return buildUrl;
      }
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(reference.url);
      const ownerFinalUrlInfo = finalKitchen.graph.getUrlInfo(
        reference.ownerUrlInfo.url,
      );
      // files from root directory but not given to rollup nor postcss
      if (rawUrlInfo) {
        const referencedUrlObject = new URL(reference.url);
        referencedUrlObject.searchParams.delete("as_js_classic");
        referencedUrlObject.searchParams.delete("as_json_module");
        const buildUrl = buildUrlsGenerator.generate(referencedUrlObject.href, {
          urlInfo: rawUrlInfo,
          ownerUrlInfo: ownerFinalUrlInfo,
        });
        associateBuildUrlAndRawUrl(buildUrl, rawUrlInfo.url, "raw file");
        return buildUrl;
      }
      if (reference.type === "sourcemap_comment") {
        // inherit parent build url
        return generateSourcemapFileUrl(reference.ownerUrlInfo.url);
      }
      // files generated during the final graph:
      // - sourcemaps
      // const finalUrlInfo = finalGraph.getUrlInfo(url)
      const buildUrl = buildUrlsGenerator.generate(reference.url, {
        urlInfo: {
          data: {},
          type: "asset",
        },
      });
      return buildUrl;
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
      const generatedUrlObject = new URL(reference.generatedUrl);
      generatedUrlObject.searchParams.delete("js_classic");
      generatedUrlObject.searchParams.delete("js_module");
      generatedUrlObject.searchParams.delete("js_module_fallback");
      generatedUrlObject.searchParams.delete("as_js_classic");
      generatedUrlObject.searchParams.delete("as_js_module");
      generatedUrlObject.searchParams.delete("as_json_module");
      generatedUrlObject.searchParams.delete("as_css_module");
      generatedUrlObject.searchParams.delete("as_text_module");
      generatedUrlObject.searchParams.delete("dynamic_import");
      generatedUrlObject.hash = "";
      const buildUrl = generatedUrlObject.href;
      const buildSpecifier = asFormattedBuildSpecifier(reference, buildUrl);
      buildSpecifierToBuildUrlMap.set(buildSpecifier, reference.generatedUrl);
      const buildSpecifierWithVersionPlaceholder =
        buildVersionsManager.generateBuildSpecifierPlaceholder(
          reference,
          buildSpecifier,
        );
      return buildSpecifierWithVersionPlaceholder;
    },
    fetchUrlContent: async (finalUrlInfo) => {
      const fromBundleOrRawGraph = (url) => {
        const bundleUrlInfo = bundleUrlInfos[url];
        if (bundleUrlInfo) {
          return bundleUrlInfo;
        }
        const rawUrl = getRawUrl(url);
        const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
        if (!rawUrlInfo) {
          throw new Error(
            createDetailedMessage(`Cannot find url`, {
              url,
              "raw urls": Array.from(buildDirectoryRedirections.values()),
              "build urls": Array.from(buildDirectoryRedirections.keys()),
            }),
          );
        }
        // logger.debug(`fetching from raw graph ${url}`)
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
          return rawUrlInfo;
        }
        return rawUrlInfo;
      };
      const { firstReference } = finalUrlInfo;
      // .original reference updated during "postbuild":
      // happens for "js_module_fallback"
      const reference = firstReference.original || firstReference;
      // reference injected during "postbuild":
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
      if (reference.isInline) {
        const prevReference = firstReference.prev;
        if (prevReference) {
          if (!prevReference.isInline) {
            // the reference was inlined
            const urlBeforeRedirect =
              getBuildUrlBeforeFinalRedirect(prevReference.url) ||
              prevReference.url;

            return fromBundleOrRawGraph(urlBeforeRedirect);
          }
          if (buildDirectoryRedirections.has(prevReference.url)) {
            // the prev reference is transformed to fetch underlying resource
            // (getWithoutSearchParam)
            return fromBundleOrRawGraph(prevReference.url);
          }
        }
        return fromBundleOrRawGraph(firstReference.url);
      }
      return fromBundleOrRawGraph(reference.url);
    },
  };

  return {
    buildVersionsManager,
    jsenvPlugin,

    generateBuildUrlForBundle: (urlInfoBundled, urlInfo) => {
      const buildUrl = buildUrlsGenerator.generate(urlInfo.url, {
        urlInfo: urlInfoBundled,
      });
      bundleRedirections.set(urlInfo.url, buildUrl);
      if (urlIsInsideOf(urlInfo.url, buildDirectoryUrl)) {
        if (urlInfoBundled.data.isDynamicEntry) {
          const rawUrlInfo = rawKitchen.graph.getUrlInfo(
            urlInfoBundled.originalUrl,
          );
          rawUrlInfo.data.bundled = false;
          bundleRedirections.set(urlInfoBundled.originalUrl, buildUrl);
          associateBuildUrlAndRawUrl(
            buildUrl,
            urlInfoBundled.originalUrl,
            "bundle",
          );
        } else {
          urlInfo.data.generatedToShareCode = true;
        }
      } else {
        associateBuildUrlAndRawUrl(buildUrl, urlInfo.url, "bundle");
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
    },

    getRawUrl,
    getBuildUrl: (url) => {
      return findKey(buildDirectoryRedirections, url);
    },
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
