import { parseHtml, findHtmlNode, getHtmlNodeAttribute, getHtmlNodeText, stringifyHtmlAst, removeHtmlNode, setHtmlNodeText, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, visitHtmlNodes, setHtmlNodeAttributes, insertHtmlNodeAfter } from "@jsenv/ast";
import { distributePercentages, ANSI, humanizeFileSize, urlIsInsideOf, urlToRelativeUrl, urlToFilename, comparePathnames, UNICODE, escapeRegexpSpecialChars, createDetailedMessage, ensurePathnameTrailingSlash, CONTENT_TYPE, injectQueryParamIntoSpecifierWithoutEncoding, renderUrlOrRelativeUrlFilename, assertAndNormalizeDirectoryUrl, lookupPackageDirectory, Abort, raceProcessTeardownEvents, createLogger, jsenvPluginBundling, jsenvPluginMinification, ensureEmptyDirectory, jsenvPluginJsModuleFallback, clearDirectorySync, writeFileSync, createTaskLog } from "../jsenv_core_packages.js";
import { GRAPH_VISITOR, prependContent, isWebWorkerUrlInfo, getDefaultBase, defaultRuntimeCompat, logsDefault, watchSourceFiles, createKitchen, createPluginStore, getCorePlugins, createPluginController, jsenvPluginReferenceAnalysis, jsenvPluginDirectoryReferenceEffect, jsenvPluginInlining } from "../plugins.js";
import { generateSourcemapFileUrl, createMagicSource } from "@jsenv/sourcemap";
import { createHash } from "node:crypto";
import "node:path";
import "node:fs";
import "node:url";
import "node:module";
import "@jsenv/js-module-fallback";
import "node:process";
import "node:os";
import "node:tty";
import "string-width";
import "@jsenv/runtime-compat";
import "node:perf_hooks";
import "@jsenv/plugin-supervisor";
import "@jsenv/server";
import "../main.js";

const createUrlGraphSummary = (
  urlGraph,
  { title = "graph summary" } = {},
) => {
  const graphReport = createUrlGraphReport(urlGraph);
  return `--- ${title} ---  
${createRepartitionMessage(graphReport)}
--------------------`;
};

const createUrlGraphReport = (urlGraph) => {
  const countGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };
  const sizeGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };

  GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
    urlGraph.rootUrlInfo,
    (urlInfo) => {
      // ignore:
      // - ignored files: we don't know their content
      // - inline files and data files: they are already taken into account in the file where they appear
      if (urlInfo.url.startsWith("ignore:")) {
        return;
      }
      if (urlInfo.isInline) {
        return;
      }
      if (urlInfo.url.startsWith("data:")) {
        return;
      }

      // file loaded via import assertion are already inside the graph
      // their js module equivalent are ignored to avoid counting it twice
      // in the build graph the file targeted by import assertion will likely be gone
      // and only the js module remain (likely bundled)
      if (
        urlInfo.searchParams.has("as_json_module") ||
        urlInfo.searchParams.has("as_css_module") ||
        urlInfo.searchParams.has("as_text_module")
      ) {
        return;
      }

      const urlContentSize = Buffer.byteLength(urlInfo.content);
      const category = determineCategory(urlInfo);
      if (category === "sourcemap") {
        countGroups.sourcemaps++;
        sizeGroups.sourcemaps += urlContentSize;
        return;
      }
      countGroups.total++;
      sizeGroups.total += urlContentSize;
      if (category === "html") {
        countGroups.html++;
        sizeGroups.html += urlContentSize;
        return;
      }
      if (category === "css") {
        countGroups.css++;
        sizeGroups.css += urlContentSize;
        return;
      }
      if (category === "js") {
        countGroups.js++;
        sizeGroups.js += urlContentSize;
        return;
      }
      if (category === "json") {
        countGroups.json++;
        sizeGroups.json += urlContentSize;
        return;
      }
      countGroups.other++;
      sizeGroups.other += urlContentSize;
      return;
    },
  );

  const sizesToDistribute = {};
  Object.keys(sizeGroups).forEach((groupName) => {
    if (groupName !== "sourcemaps" && groupName !== "total") {
      sizesToDistribute[groupName] = sizeGroups[groupName];
    }
  });
  const percentageGroups = distributePercentages(sizesToDistribute);

  return {
    // sourcemaps are special, there size are ignored
    // so there is no "percentage" associated
    sourcemaps: {
      count: countGroups.sourcemaps,
      size: sizeGroups.sourcemaps,
      percentage: undefined,
    },

    html: {
      count: countGroups.html,
      size: sizeGroups.html,
      percentage: percentageGroups.html,
    },
    css: {
      count: countGroups.css,
      size: sizeGroups.css,
      percentage: percentageGroups.css,
    },
    js: {
      count: countGroups.js,
      size: sizeGroups.js,
      percentage: percentageGroups.js,
    },
    json: {
      count: countGroups.json,
      size: sizeGroups.json,
      percentage: percentageGroups.json,
    },
    other: {
      count: countGroups.other,
      size: sizeGroups.other,
      percentage: percentageGroups.other,
    },
    total: {
      count: countGroups.total,
      size: sizeGroups.total,
      percentage: 100,
    },
  };
};

const determineCategory = (urlInfo) => {
  if (urlInfo.type === "sourcemap") {
    return "sourcemap";
  }
  if (urlInfo.type === "html") {
    return "html";
  }
  if (urlInfo.type === "css") {
    return "css";
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js";
  }
  if (urlInfo.type === "json") {
    return "json";
  }
  return "other";
};

const createRepartitionMessage = ({ html, css, js, json, other, total }) => {
  const addPart = (name, { count, size, percentage }) => {
    parts.push(
      `${ANSI.color(`${name}:`, ANSI.GREY)} ${count} (${humanizeFileSize(
        size,
      )} / ${percentage} %)`,
    );
  };

  const parts = [];
  // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${humanizeFileSize(sourcemaps.size)})`,
  //   )
  // }
  if (html.count) {
    addPart("html ", html);
  }
  if (css.count) {
    addPart("css  ", css);
  }
  if (js.count) {
    addPart("js   ", js);
  }
  if (json.count) {
    addPart("json ", json);
  }
  if (other.count) {
    addPart("other", other);
  }
  addPart("total", total);
  return `- ${parts.join(`
- `)}`;
};

const createBuildUrlsGenerator = ({
  logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  assetsDirectory,
}) => {
  const cache = {};
  const getUrlName = (url, urlInfo) => {
    if (!urlInfo) {
      return urlToFilename(url);
    }
    if (urlInfo.filenameHint) {
      return urlInfo.filenameHint;
    }
    return urlToFilename(url);
  };

  const buildUrlCache = new Map();

  const associateBuildUrl = (url, buildUrl) => {
    buildUrlCache.set(url, buildUrl);
    logger.debug(`associate a build url
${ANSI.color(url, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
      `);
  };

  const generate = (url, { urlInfo, ownerUrlInfo }) => {
    const buildUrlFromCache = buildUrlCache.get(url);
    if (buildUrlFromCache) {
      return buildUrlFromCache;
    }
    if (urlIsInsideOf(url, buildDirectoryUrl)) {
      buildUrlCache.set(url, url);
      return url;
    }
    if (
      urlInfo.type === "directory" ||
      (urlInfo.type === undefined && urlInfo.typeHint === "directory")
    ) {
      let directoryPath;
      if (url === sourceDirectoryUrl) {
        directoryPath = "";
      } else if (urlInfo.filenameHint) {
        directoryPath = urlInfo.filenameHint;
      } else {
        directoryPath = urlToRelativeUrl(url, sourceDirectoryUrl);
      }
      const { search } = new URL(url);
      const buildUrl = `${buildDirectoryUrl}${directoryPath}${search}`;
      associateBuildUrl(url, buildUrl);
      return buildUrl;
    }

    const directoryPath = determineDirectoryPath({
      sourceDirectoryUrl,
      assetsDirectory,
      urlInfo,
      ownerUrlInfo,
    });
    let names = cache[directoryPath];
    if (!names) {
      names = [];
      cache[directoryPath] = names;
    }
    const urlObject = new URL(url);
    let { search, hash } = urlObject;
    let name = getUrlName(url, urlInfo);
    let [basename, extension] = splitFileExtension(name);
    extension = extensionMappings[extension] || extension;
    let nameCandidate = `${basename}${extension}`; // reconstruct name in case extension was normalized
    let integer = 1;
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate);
        break;
      }
      integer++;
      nameCandidate = `${basename}${integer}${extension}`;
    }
    const buildUrl = `${buildDirectoryUrl}${directoryPath}${nameCandidate}${search}${hash}`;
    associateBuildUrl(url, buildUrl);
    return buildUrl;
  };

  return {
    generate,
  };
};

// It's best to generate files with an extension representing what is inside the file
// and after build js files contains solely js (js or typescript is gone).
// This way a static file server is already configured to server the correct content-type
// (otherwise one would have to configure that ".jsx" is "text/javascript")
// To keep in mind: if you have "user.jsx" and "user.js" AND both file are not bundled
// you end up with "dist/js/user.js" and "dist/js/user2.js"
const extensionMappings = {
  ".jsx": ".js",
  ".ts": ".js",
  ".tsx": ".js",
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

const determineDirectoryPath = ({
  sourceDirectoryUrl,
  assetsDirectory,
  urlInfo,
  ownerUrlInfo,
}) => {
  if (urlInfo.dirnameHint) {
    return urlInfo.dirnameHint;
  }
  if (urlInfo.type === "directory") {
    return "";
  }
  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath({
      sourceDirectoryUrl,
      assetsDirectory,
      urlInfo: ownerUrlInfo || urlInfo.firstReference.ownerUrlInfo,
    });
    return parentDirectoryPath;
  }
  if (urlInfo.isEntryPoint && !urlInfo.isDynamicEntryPoint) {
    return "";
  }
  if (urlInfo.type === "importmap") {
    return "";
  }
  if (urlInfo.type === "html") {
    return `${assetsDirectory}html/`;
  }
  if (urlInfo.type === "css") {
    return `${assetsDirectory}css/`;
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return `${assetsDirectory}js/`;
  }
  if (urlInfo.type === "json") {
    return `${assetsDirectory}json/`;
  }
  return `${assetsDirectory}other/`;
};

// https://bundlers.tooling.report/hashing/avoid-cascade/


const injectGlobalMappings = async (urlInfo, mappings) => {
  if (urlInfo.type === "html") {
    const minification = Boolean(
      urlInfo.context.getPluginMeta("willMinifyJsClassic"),
    );
    const content = generateClientCodeForMappings(mappings, {
      globalName: "window",
      minification,
    });
    await prependContent(urlInfo, { type: "js_classic", content });
    return;
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    const minification = Boolean(
      urlInfo.context.getPluginMeta("willMinifyJsClassic"),
    );
    const content = generateClientCodeForMappings(mappings, {
      globalName: isWebWorkerUrlInfo(urlInfo) ? "self" : "window",
      minification,
    });
    await prependContent(urlInfo, { type: "js_classic", content });
    return;
  }
};

const generateClientCodeForMappings = (
  versionMappings,
  { globalName, minification },
) => {
  if (minification) {
    return `;(function(){var m = ${JSON.stringify(
      versionMappings,
    )}; ${globalName}.__v__ = function (s) { return m[s] || s }; })();`;
  }
  return `;(function() {
  var __versionMappings__ = {
    ${stringifyParams(versionMappings, "    ")}
  };
  ${globalName}.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();`;
};

const injectImportmapMappings = (urlInfo, getMappings) => {
  const htmlAst = parseHtml({
    html: urlInfo.content,
    url: urlInfo.url,
    storeOriginalPositions: false,
  });
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  const importmapMinification = Boolean(
    urlInfo.context.getPluginMeta("willMinifyJson"),
  );
  const importmapNode = findHtmlNode(htmlAst, (node) => {
    return (
      node.tagName === "script" &&
      getHtmlNodeAttribute(node, "type") === "importmap"
    );
  });
  const generateMappingText = (mappings) => {
    if (importmapMinification) {
      return JSON.stringify({ imports: mappings });
    }
    return JSON.stringify({ imports: mappings }, null, "  ");
  };

  const mutate = (mutation) => {
    mutation();
    urlInfo.mutateContent({
      content: stringifyHtmlAst(htmlAst),
    });
  };

  if (importmapNode) {
    // we want to remove some mappings, override others, add eventually add new
    const currentMappings = JSON.parse(getHtmlNodeText(importmapNode));
    const mappings = getMappings(currentMappings.imports);
    if (!mappings || Object.keys(mappings).length === 0) {
      mutate(() => {
        removeHtmlNode(importmapNode);
      });
      return;
    }
    mutate(() => {
      setHtmlNodeText(importmapNode, generateMappingText(mappings), {
        indentation: "auto",
      });
    });
    return;
  }
  const mappings = getMappings(null);
  if (!mappings || Object.keys(mappings).length === 0) {
    return;
  }
  mutate(() => {
    injectHtmlNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        type: "importmap",
        children: generateMappingText(getMappings(null)),
      }),
      "jsenv:versioning",
    );
  });
  return;
};

const stringifyParams = (params, prefix = "") => {
  const source = JSON.stringify(params, null, prefix);
  if (prefix.length) {
    // remove leading "{\n"
    // remove leading prefix
    // remove trailing "\n}"
    return source.slice(2 + prefix.length, -2);
  }
  // remove leading "{"
  // remove trailing "}"
  return source.slice(1, -1);
};

const createBuildSpecifierManager = ({
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
    logger,
    sourceDirectoryUrl,
    buildDirectoryUrl,
    assetsDirectory,
  });
  const placeholderAPI = createPlaceholderAPI({
    length,
  });
  const placeholderToReferenceMap = new Map();
  const urlInfoToBuildUrlMap = new Map();
  const buildUrlToUrlInfoMap = new Map();
  const buildUrlToBuildSpecifierMap = new Map();

  const generateReplacement = (reference) => {
    let buildUrl;
    if (reference.type === "sourcemap_comment") {
      const parentBuildUrl = urlInfoToBuildUrlMap.get(reference.ownerUrlInfo);
      buildUrl = generateSourcemapFileUrl(parentBuildUrl);
      reference.generatedSpecifier = buildUrl;
    } else {
      const url = reference.generatedUrl;
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
      buildUrl = buildUrlsGenerator.generate(url, {
        urlInfo,
        ownerUrlInfo: reference.ownerUrlInfo,
      });
    }

    let buildSpecifier;
    if (base === "./") {
      const { ownerUrlInfo } = reference;
      const parentBuildUrl = ownerUrlInfo.isRoot
        ? buildDirectoryUrl
        : urlInfoToBuildUrlMap.get(
            ownerUrlInfo.isInline
              ? ownerUrlInfo.findParentIfInline()
              : ownerUrlInfo,
          );
      const urlRelativeToParent = urlToRelativeUrl(buildUrl, parentBuildUrl);
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
    buildUrlToUrlInfoMap.set(buildUrl, reference.urlInfo);
    buildUrlToBuildSpecifierMap.set(buildUrl, buildSpecifier);
    const buildGeneratedSpecifier = applyVersioningOnBuildSpecifier(
      buildSpecifier,
      reference,
    );
    return buildGeneratedSpecifier;
  };
  const internalRedirections = new Map();
  const bundleInfoMap = new Map();

  const applyBundling = async ({ bundler, urlInfosToBundle }) => {
    const urlInfosBundled = await rawKitchen.pluginController.callAsyncHook(
      {
        plugin: bundler.plugin,
        hookName: "bundle",
        value: bundler.bundleFunction,
      },
      urlInfosToBundle,
    );
    for (const url of Object.keys(urlInfosBundled)) {
      const urlInfoBundled = urlInfosBundled[url];
      if (urlInfoBundled.sourceUrls) {
        for (const sourceUrl of urlInfoBundled.sourceUrls) {
          const sourceRawUrlInfo = rawKitchen.graph.getUrlInfo(sourceUrl);
          if (sourceRawUrlInfo) {
            sourceRawUrlInfo.data.bundled = true;
          }
        }
      }
      bundleInfoMap.set(url, urlInfoBundled);
    }
  };

  const jsenvPluginMoveToBuildDirectory = {
    name: "jsenv:move_to_build_directory",
    appliesDuring: "build",
    // reference resolution is split in 2
    // the redirection to build directory is done in a second phase (redirectReference)
    // to let opportunity to others plugins (js_module_fallback)
    // to mutate reference (inject ?js_module_fallback)
    // before it gets redirected to build directory
    resolveReference: (reference) => {
      const { ownerUrlInfo } = reference;
      if (ownerUrlInfo.remapReference && !reference.isInline) {
        const newSpecifier = ownerUrlInfo.remapReference(reference);
        reference.specifier = newSpecifier;
      }
      const referenceFromPlaceholder = placeholderToReferenceMap.get(
        reference.specifier,
      );
      if (referenceFromPlaceholder) {
        return referenceFromPlaceholder.url;
      }
      if (reference.type === "filesystem") {
        const ownerRawUrl = ensurePathnameTrailingSlash(ownerUrlInfo.url);
        const url = new URL(reference.specifier, ownerRawUrl).href;
        return url;
      }
      if (reference.specifierPathname[0] === "/") {
        const url = new URL(reference.specifier.slice(1), sourceDirectoryUrl)
          .href;
        return url;
      }
      if (reference.injected) {
        // js_module_fallback
        const url = new URL(
          reference.specifier,
          reference.baseUrl || ownerUrlInfo.url,
        ).href;
        return url;
      }
      const parentUrl = reference.baseUrl || ownerUrlInfo.url;
      const url = new URL(reference.specifier, parentUrl).href;
      return url;
    },
    redirectReference: (reference) => {
      let referenceBeforeInlining = reference;
      if (
        referenceBeforeInlining.isInline &&
        referenceBeforeInlining.prev &&
        !referenceBeforeInlining.prev.isInline
      ) {
        referenceBeforeInlining = referenceBeforeInlining.prev;
      }
      const rawUrl = referenceBeforeInlining.url;
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
      if (rawUrlInfo) {
        reference.filenameHint = rawUrlInfo.filenameHint;
        return null;
      }
      if (referenceBeforeInlining.injected) {
        return null;
      }
      if (
        referenceBeforeInlining.isInline &&
        referenceBeforeInlining.ownerUrlInfo.url ===
          referenceBeforeInlining.ownerUrlInfo.originalUrl
      ) {
        const rawUrlInfo = findRawUrlInfoWhenInline(
          referenceBeforeInlining,
          rawKitchen,
        );
        if (rawUrlInfo) {
          reference.rawUrl = rawUrlInfo.url;
          reference.filenameHint = rawUrlInfo.filenameHint;
          return null;
        }
      }
      reference.filenameHint = referenceBeforeInlining.filenameHint;
      return null;
    },
    transformReferenceSearchParams: () => {
      // those search params are reflected into the build file name
      // moreover it create cleaner output
      // otherwise output is full of ?js_module_fallback search param
      return {
        js_module_fallback: undefined,
        as_json_module: undefined,
        as_css_module: undefined,
        as_text_module: undefined,
        as_js_module: undefined,
        as_js_classic: undefined,
        cjs_as_js_module: undefined,
        js_classic: undefined, // TODO: add comment to explain who is using this
        entry_point: undefined,
        dynamic_import: undefined,
      };
    },
    formatReference: (reference) => {
      const generatedUrl = reference.generatedUrl;
      if (!generatedUrl.startsWith("file:")) {
        return null;
      }
      if (reference.isWeak && reference.expectedType !== "directory") {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      const placeholder = placeholderAPI.generate();
      if (generatedUrl !== reference.url) {
        internalRedirections.set(generatedUrl, reference.url);
      }
      placeholderToReferenceMap.set(placeholder, reference);
      return placeholder;
    },
    fetchUrlContent: async (finalUrlInfo) => {
      // not need because it will be inherit from rawUrlInfo
      // if (urlIsInsideOf(finalUrlInfo.url, buildDirectoryUrl)) {
      //   finalUrlInfo.type = "asset";
      // }
      let { firstReference } = finalUrlInfo;
      if (
        firstReference.isInline &&
        firstReference.prev &&
        !firstReference.prev.isInline
      ) {
        firstReference = firstReference.prev;
      }
      const rawUrl = firstReference.rawUrl || firstReference.url;
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
      const bundleInfo = bundleInfoMap.get(rawUrl);
      if (bundleInfo) {
        finalUrlInfo.remapReference = bundleInfo.remapReference;
        return {
          // url: bundleInfo.url,
          originalUrl: bundleInfo.originalUrl,
          type: bundleInfo.type,
          content: bundleInfo.content,
          contentType: bundleInfo.contentType,
          sourcemap: bundleInfo.sourcemap,
          data: bundleInfo.data,
        };
      }
      if (rawUrlInfo) {
        return rawUrlInfo;
      }
      // reference injected during "shape":
      // - "js_module_fallback" using getWithoutSearchParam to obtain source
      //   url info that will be converted to systemjs/UMD
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
          isInline: reference.isInline,
          filenameHint: reference.filenameHint,
          content: reference.content,
          contentType: reference.contentType,
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
      if (firstReference.isInline) {
        if (
          firstReference.ownerUrlInfo.url ===
          firstReference.ownerUrlInfo.originalUrl
        ) {
          if (rawUrlInfo) {
            return rawUrlInfo;
          }
        }
        return {
          originalContent: finalUrlInfo.originalContent,
          content: firstReference.content,
          contentType: firstReference.contentType,
        };
      }
      throw new Error(createDetailedMessage(`${rawUrl} not found in graph`));
    },
  };

  const buildSpecifierToBuildSpecifierVersionedMap = new Map();

  const versionMap = new Map();

  const referenceInSeparateContextSet = new Set();
  const referenceVersioningInfoMap = new Map();
  const _getReferenceVersioningInfo = (reference) => {
    if (!shouldApplyVersioningOnReference(reference)) {
      return {
        type: "not_versioned",
      };
    }
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
          return placeholderAPI.markAsCode(
            `${ownerUrlInfo.jsQuote}+__v__(${JSON.stringify(buildSpecifier)})+${
              ownerUrlInfo.jsQuote
            }`,
          );
        },
      };
    }
    if (reference.type === "js_url") {
      return {
        type: "global",
        render: (buildSpecifier) => {
          return placeholderAPI.markAsCode(
            `__v__(${JSON.stringify(buildSpecifier)})`,
          );
        },
      };
    }
    if (reference.type === "js_import") {
      if (reference.subtype === "import_dynamic") {
        return {
          type: "global",
          render: (buildSpecifier) => {
            return placeholderAPI.markAsCode(
              `__v__(${JSON.stringify(buildSpecifier)})`,
            );
          },
        };
      }
      if (reference.subtype === "import_meta_resolve") {
        return {
          type: "global",
          render: (buildSpecifier) => {
            return placeholderAPI.markAsCode(
              `__v__(${JSON.stringify(buildSpecifier)})`,
            );
          },
        };
      }
      if (canUseImportmap && !isInsideSeparateContext(reference)) {
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
          buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
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
  const isInsideSeparateContext = (reference) => {
    if (referenceInSeparateContextSet.has(reference)) {
      return true;
    }
    const referenceOwnerUrllInfo = reference.ownerUrlInfo;
    let is = false;
    if (isWebWorkerUrlInfo(referenceOwnerUrllInfo)) {
      is = true;
    } else {
      GRAPH_VISITOR.findDependent(
        referenceOwnerUrllInfo,
        (dependentUrlInfo) => {
          if (isWebWorkerUrlInfo(dependentUrlInfo)) {
            is = true;
            return true;
          }
          return false;
        },
      );
    }
    if (is) {
      referenceInSeparateContextSet.add(reference);
      return true;
    }
    return false;
  };
  const canUseVersionedUrl = (urlInfo) => {
    if (urlInfo.isRoot) {
      return false;
    }
    if (urlInfo.isEntryPoint) {
      // if (urlInfo.subtype === "worker") {
      //   return true;
      // }
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
    if (reference.type === "sourcemap_comment") {
      return false;
    }
    if (reference.expectedType === "directory") {
      return true;
    }
    // specifier comes from "normalize" hook done a bit earlier in this file
    // we want to get back their build url to access their infos
    const referencedUrlInfo = reference.urlInfo;
    if (!canUseVersionedUrl(referencedUrlInfo)) {
      return false;
    }
    return true;
  };

  const prepareVersioning = () => {
    const contentOnlyVersionMap = new Map();
    const urlInfoToContainedPlaceholderSetMap = new Map();
    const directoryUrlInfoSet = new Set();
    {
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
              parseHtml({
                html: urlInfo.content,
                url: urlInfo.url,
                storeOriginalPositions: false,
              }),
              {
                cleanupJsenvAttributes: true,
                cleanupPositionAttributes: true,
              },
            );
          }
          const containedPlaceholderSet = new Set();
          if (mayUsePlaceholder(urlInfo)) {
            const contentWithPredictibleVersionPlaceholders =
              placeholderAPI.replaceWithDefault(content, (placeholder) => {
                containedPlaceholderSet.add(placeholder);
              });
            content = contentWithPredictibleVersionPlaceholders;
          }
          urlInfoToContainedPlaceholderSetMap.set(
            urlInfo,
            containedPlaceholderSet,
          );
          const contentVersion = generateVersion([content], versionLength);
          contentOnlyVersionMap.set(urlInfo, contentVersion);
        },
        {
          directoryUrlInfoSet,
        },
      );
    }

    {
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

      for (const [
        contentOnlyUrlInfo,
        contentOnlyVersion,
      ] of contentOnlyVersionMap) {
        const setOfUrlInfoInfluencingVersion =
          getSetOfUrlInfoInfluencingVersion(contentOnlyUrlInfo);
        const versionPartSet = new Set();
        versionPartSet.add(contentOnlyVersion);
        for (const urlInfoInfluencingVersion of setOfUrlInfoInfluencingVersion) {
          const otherUrlInfoContentVersion = contentOnlyVersionMap.get(
            urlInfoInfluencingVersion,
          );
          if (!otherUrlInfoContentVersion) {
            throw new Error(
              `cannot find content version for ${urlInfoInfluencingVersion.url} (used by ${contentOnlyUrlInfo.url})`,
            );
          }
          versionPartSet.add(otherUrlInfoContentVersion);
        }
        const version = generateVersion(versionPartSet, versionLength);
        versionMap.set(contentOnlyUrlInfo, version);
      }
    }

    {
      // we should grab all the files inside this directory
      // they will influence his versioning
      for (const directoryUrlInfo of directoryUrlInfoSet) {
        const directoryUrl = directoryUrlInfo.url;
        // const urlInfoInsideThisDirectorySet = new Set();
        const versionsInfluencingThisDirectorySet = new Set();
        for (const [url, urlInfo] of finalKitchen.graph.urlInfoMap) {
          if (!urlIsInsideOf(url, directoryUrl)) {
            continue;
          }
          // ideally we should exclude eventual directories as the are redundant
          // with the file they contains
          const version = versionMap.get(urlInfo);
          if (version !== undefined) {
            versionsInfluencingThisDirectorySet.add(version);
          }
        }
        const contentVersion =
          versionsInfluencingThisDirectorySet.size === 0
            ? "empty"
            : generateVersion(
                versionsInfluencingThisDirectorySet,
                versionLength,
              );
        versionMap.set(directoryUrlInfo, contentVersion);
      }
    }
  };

  const importMappings = {};
  const globalMappings = {};

  const applyVersioningOnBuildSpecifier = (buildSpecifier, reference) => {
    if (!versioning) {
      return buildSpecifier;
    }
    const referenceVersioningInfo = getReferenceVersioningInfo(reference);
    if (referenceVersioningInfo.type === "not_versioned") {
      return buildSpecifier;
    }
    const version = versionMap.get(reference.urlInfo);
    if (version === undefined) {
      return buildSpecifier;
    }
    const buildSpecifierVersioned = injectVersionIntoBuildSpecifier({
      buildSpecifier,
      versioningMethod,
      version,
    });
    buildSpecifierToBuildSpecifierVersionedMap.set(
      buildSpecifier,
      buildSpecifierVersioned,
    );
    return referenceVersioningInfo.render(buildSpecifier);
  };
  const finishVersioning = async () => {
    {
      for (const [reference, versioningInfo] of referenceVersioningInfoMap) {
        if (versioningInfo.type === "global") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
          globalMappings[buildSpecifier] = buildSpecifierVersioned;
        }
        if (versioningInfo.type === "importmap") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
          importMappings[buildSpecifier] = buildSpecifierVersioned;
        }
      }
    }
  };

  const getBuildGeneratedSpecifier = (urlInfo) => {
    const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
    const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
    const buildGeneratedSpecifier =
      buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier) ||
      buildSpecifier;
    return buildGeneratedSpecifier;
  };

  return {
    jsenvPluginMoveToBuildDirectory,
    applyBundling,

    remapPlaceholder: (specifier) => {
      const reference = placeholderToReferenceMap.get(specifier);
      if (reference) {
        return reference.specifier;
      }
      return specifier;
    },

    replacePlaceholders: async () => {
      if (versioning) {
        prepareVersioning();
      }
      const urlInfoSet = new Set();
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          urlInfoSet.add(urlInfo);
          if (urlInfo.isEntryPoint) {
            generateReplacement(urlInfo.firstReference);
          }
          if (urlInfo.type === "sourcemap") {
            const { referenceFromOthersSet } = urlInfo;
            let lastRef;
            for (const ref of referenceFromOthersSet) {
              lastRef = ref;
            }
            generateReplacement(lastRef);
          }
          if (urlInfo.isInline) {
            generateReplacement(urlInfo.firstReference);
          }
          if (urlInfo.firstReference.type === "side_effect_file") {
            // side effect stuff must be generated too
            generateReplacement(urlInfo.firstReference);
          }
          if (mayUsePlaceholder(urlInfo)) {
            const contentBeforeReplace = urlInfo.content;
            const { content, sourcemap } = placeholderAPI.replaceAll(
              contentBeforeReplace,
              (placeholder) => {
                const reference = placeholderToReferenceMap.get(placeholder);
                const value = generateReplacement(reference);
                return value;
              },
            );
            urlInfo.mutateContent({ content, sourcemap });
          }
        },
      );
      referenceInSeparateContextSet.clear();
      if (versioning) {
        await finishVersioning();
      }
      const actions = [];
      const visitors = [];
      if (Object.keys(globalMappings).length > 0) {
        visitors.push((urlInfo) => {
          if (urlInfo.isRoot) {
            return;
          }
          if (!urlInfo.isEntryPoint) {
            return;
          }
          actions.push(async () => {
            await injectGlobalMappings(urlInfo, globalMappings);
          });
        });
      }
      {
        visitors.push((urlInfo) => {
          if (urlInfo.isRoot) {
            return;
          }
          if (!urlInfo.isEntryPoint) {
            return;
          }
          if (urlInfo.type !== "html") {
            return;
          }

          actions.push(async () => {
            await injectImportmapMappings(urlInfo, (topLevelMappings) => {
              if (!topLevelMappings) {
                return importMappings;
              }
              const topLevelMappingsToKeep = {};
              for (const topLevelMappingKey of Object.keys(topLevelMappings)) {
                const topLevelMappingValue =
                  topLevelMappings[topLevelMappingKey];
                const urlInfo = finalKitchen.graph.getUrlInfo(
                  `ignore:${topLevelMappingKey}`,
                );
                if (urlInfo) {
                  topLevelMappingsToKeep[topLevelMappingKey] =
                    topLevelMappingValue;
                }
              }
              return {
                ...topLevelMappingsToKeep,
                ...importMappings,
              };
            });
          });
        });
      }

      if (visitors.length) {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          for (const visitor of visitors) {
            visitor(urlInfo);
          }
        });
        if (actions.length) {
          await Promise.all(actions.map((action) => action()));
        }
      }

      for (const urlInfo of urlInfoSet) {
        urlInfo.kitchen.urlInfoTransformer.applySourcemapOnContent(
          urlInfo,
          (source) => {
            const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
            if (buildUrl) {
              return urlToRelativeUrl(source, buildUrl);
            }
            return source;
          },
        );
      }
      urlInfoSet.clear();
    },

    prepareResyncResourceHints: ({ registerHtmlRefine }) => {
      const hintToInjectMap = new Map();
      registerHtmlRefine((htmlAst, { registerHtmlMutation }) => {
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const href = getHtmlNodeAttribute(node, "href");
            if (href === undefined || href.startsWith("data:")) {
              return;
            }
            const rel = getHtmlNodeAttribute(node, "rel");
            const isResourceHint = [
              "preconnect",
              "dns-prefetch",
              "prefetch",
              "preload",
              "modulepreload",
            ].includes(rel);
            if (!isResourceHint) {
              return;
            }
            const rawUrl = href;
            const finalUrl = internalRedirections.get(rawUrl) || rawUrl;
            const urlInfo = finalKitchen.graph.getUrlInfo(finalUrl);
            if (!urlInfo) {
              logger.warn(
                `${UNICODE.WARNING} remove resource hint because cannot find "${href}" in the graph`,
              );
              registerHtmlMutation(() => {
                removeHtmlNode(node);
              });
              return;
            }
            if (!urlInfo.isUsed()) {
              const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
              if (rawUrlInfo && rawUrlInfo.data.bundled) {
                logger.warn(
                  `${UNICODE.WARNING} remove resource hint on "${href}" because it was bundled`,
                );
                registerHtmlMutation(() => {
                  removeHtmlNode(node);
                });
                return;
              }
              logger.warn(
                `${UNICODE.WARNING} remove resource hint on "${href}" because it is not used anymore`,
              );
              registerHtmlMutation(() => {
                removeHtmlNode(node);
              });
              return;
            }
            const buildGeneratedSpecifier = getBuildGeneratedSpecifier(urlInfo);
            registerHtmlMutation(() => {
              setHtmlNodeAttributes(node, {
                href: buildGeneratedSpecifier,
                ...(urlInfo.type === "js_classic"
                  ? { crossorigin: undefined }
                  : {}),
              });
            });
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (referenceToOther.isWeak) {
                continue;
              }
              const referencedUrlInfo = referenceToOther.urlInfo;
              if (referencedUrlInfo.data.generatedToShareCode) {
                hintToInjectMap.set(referencedUrlInfo, { node });
              }
            }
          },
        });
        for (const [referencedUrlInfo, { node }] of hintToInjectMap) {
          const buildGeneratedSpecifier =
            getBuildGeneratedSpecifier(referencedUrlInfo);
          const found = findHtmlNode(htmlAst, (htmlNode) => {
            return (
              htmlNode.nodeName === "link" &&
              getHtmlNodeAttribute(htmlNode, "href") === buildGeneratedSpecifier
            );
          });
          if (found) {
            continue;
          }
          registerHtmlMutation(() => {
            const nodeToInsert = createHtmlNode({
              tagName: "link",
              rel: getHtmlNodeAttribute(node, "rel"),
              href: buildGeneratedSpecifier,
              as: getHtmlNodeAttribute(node, "as"),
              type: getHtmlNodeAttribute(node, "type"),
              crossorigin: getHtmlNodeAttribute(node, "crossorigin"),
            });
            insertHtmlNodeAfter(nodeToInsert, node);
          });
        }
      });
    },

    prepareServiceWorkerUrlInjection: () => {
      const serviceWorkerEntryUrlInfos = GRAPH_VISITOR.filter(
        finalKitchen.graph,
        (finalUrlInfo) => {
          return (
            finalUrlInfo.subtype === "service_worker" &&
            finalUrlInfo.isEntryPoint &&
            finalUrlInfo.isUsed()
          );
        },
      );
      if (serviceWorkerEntryUrlInfos.length === 0) {
        return null;
      }
      return async () => {
        const allResourcesFromJsenvBuild = {};
        GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
          finalKitchen.graph.rootUrlInfo,
          (urlInfo) => {
            if (!urlInfo.url.startsWith("file:")) {
              return;
            }
            if (urlInfo.isInline) {
              return;
            }

            const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
            const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
            if (canUseVersionedUrl(urlInfo)) {
              const buildSpecifierVersioned = versioning
                ? buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier)
                : null;
              allResourcesFromJsenvBuild[buildSpecifier] = {
                version: versionMap.get(urlInfo),
                versionedUrl: buildSpecifierVersioned,
              };
            } else {
              // when url is not versioned we compute a "version" for that url anyway
              // so that service worker source still changes and navigator
              // detect there is a change
              allResourcesFromJsenvBuild[buildSpecifier] = {
                version: versionMap.get(urlInfo),
              };
            }
          },
        );
        for (const serviceWorkerEntryUrlInfo of serviceWorkerEntryUrlInfos) {
          const resourcesFromJsenvBuild = {
            ...allResourcesFromJsenvBuild,
          };
          const serviceWorkerBuildUrl = urlInfoToBuildUrlMap.get(
            serviceWorkerEntryUrlInfo,
          );
          const serviceWorkerBuildSpecifier = buildUrlToBuildSpecifierMap.get(
            serviceWorkerBuildUrl,
          );
          delete resourcesFromJsenvBuild[serviceWorkerBuildSpecifier];
          await prependContent(serviceWorkerEntryUrlInfo, {
            type: "js_classic",
            content: `self.resourcesFromJsenvBuild = ${JSON.stringify(
              resourcesFromJsenvBuild,
              null,
              "  ",
            )};\n`,
          });
        }
      };
    },

    getBuildInfo: () => {
      const buildManifest = {};
      const buildContents = {};
      const buildInlineRelativeUrlSet = new Set();
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          if (!buildUrl) {
            return;
          }
          if (
            urlInfo.type === "asset" &&
            urlIsInsideOf(urlInfo.url, buildDirectoryUrl)
          ) {
            return;
          }
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned = versioning
            ? buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier)
            : null;
          const buildRelativeUrl = urlToRelativeUrl(
            buildUrl,
            buildDirectoryUrl,
          );
          let contentKey;
          // if to guard for html where versioned build specifier is not generated
          if (buildSpecifierVersioned) {
            const buildUrlVersioned = asBuildUrlVersioned({
              buildSpecifierVersioned,
              buildDirectoryUrl,
            });
            const buildRelativeUrlVersioned = urlToRelativeUrl(
              buildUrlVersioned,
              buildDirectoryUrl,
            );
            buildManifest[buildRelativeUrl] = buildRelativeUrlVersioned;
            contentKey = buildRelativeUrlVersioned;
          } else {
            contentKey = buildRelativeUrl;
          }
          if (urlInfo.type !== "directory") {
            buildContents[contentKey] = urlInfo.content;
          }
          if (urlInfo.isInline) {
            buildInlineRelativeUrlSet.add(buildRelativeUrl);
          }
        },
      );
      const buildFileContents = {};
      const buildInlineContents = {};
      Object.keys(buildContents)
        .sort((a, b) => comparePathnames(a, b))
        .forEach((buildRelativeUrl) => {
          if (buildInlineRelativeUrlSet.has(buildRelativeUrl)) {
            buildInlineContents[buildRelativeUrl] =
              buildContents[buildRelativeUrl];
          } else {
            buildFileContents[buildRelativeUrl] =
              buildContents[buildRelativeUrl];
          }
        });

      return { buildFileContents, buildInlineContents, buildManifest };
    },
  };
};

const findRawUrlInfoWhenInline = (reference, rawKitchen) => {
  const rawUrlInfo = GRAPH_VISITOR.find(
    rawKitchen.graph,
    (rawUrlInfoCandidate) => {
      const { inlineUrlSite } = rawUrlInfoCandidate;
      if (!inlineUrlSite) {
        return false;
      }
      if (
        inlineUrlSite.url === reference.ownerUrlInfo.url &&
        inlineUrlSite.line === reference.specifierLine &&
        inlineUrlSite.column === reference.specifierColumn &&
        rawUrlInfoCandidate.contentType === reference.contentType
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
  return rawUrlInfo;
};

// see https://github.com/rollup/rollup/blob/ce453507ab8457dd1ea3909d8dd7b117b2d14fab/src/utils/hashPlaceholders.ts#L1
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
  const replaceWithDefault = (code, onPlaceholder) => {
    const transformedCode = code.replace(PLACEHOLDER_REGEX, (placeholder) => {
      onPlaceholder(placeholder);
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

  const markAsCode = (string) => {
    return {
      __isCode__: true,
      toString: () => string,
      value: string,
    };
  };

  const replaceAll = (string, replacer) => {
    const magicSource = createMagicSource(string);

    string.replace(PLACEHOLDER_REGEX, (placeholder, index) => {
      const replacement = replacer(placeholder, index);
      if (!replacement) {
        return;
      }
      let value;
      let isCode = false;
      if (replacement && replacement.__isCode__) {
        value = replacement.value;
        isCode = true;
      } else {
        value = replacement;
      }

      let start = index;
      let end = start + placeholder.length;
      if (
        isCode &&
        // when specifier is wrapper by quotes
        // we remove the quotes to transform the string
        // into code that will be executed
        isWrappedByQuote(string, start, end)
      ) {
        start = start - 1;
        end = end + 1;
      }
      magicSource.replace({
        start,
        end,
        replacement: value,
      });
    });
    return magicSource.toContentAndSourcemap();
  };

  return {
    generate,
    replaceFirst,
    replaceAll,
    extractFirst,
    markAsCode,
    replaceWithDefault,
  };
};

const mayUsePlaceholder = (urlInfo) => {
  if (urlInfo.referenceToOthersSet.size === 0) {
    return false;
  }
  if (!CONTENT_TYPE.isTextual(urlInfo.contentType)) {
    return false;
  }
  return true;
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

const ensureUnixLineBreaks = (stringOrBuffer) => {
  if (typeof stringOrBuffer === "string") {
    const stringWithLinuxBreaks = stringOrBuffer.replace(/\r\n/g, "\n");
    return stringWithLinuxBreaks;
  }
  return ensureUnixLineBreaksOnBuffer(stringOrBuffer);
};

// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const ensureUnixLineBreaksOnBuffer = (buffer) => {
  const int32Array = new Int32Array(buffer, 0, buffer.length);
  const int32ArrayWithLineBreaksNormalized = int32Array.filter(
    (element, index, typedArray) => {
      if (element === 0x0d) {
        if (typedArray[index + 1] === 0x0a) {
          // Windows -> Unix
          return false;
        }
        // Mac OS -> Unix
        typedArray[index] = 0x0a;
      }
      return true;
    },
  );
  return Buffer.from(int32ArrayWithLineBreaksNormalized);
};

const jsenvPluginLineBreakNormalization = () => {
  return {
    name: "jsenv:line_break_normalizer",
    appliesDuring: "build",
    transformUrlContent: (urlInfo) => {
      if (CONTENT_TYPE.isTextual(urlInfo.contentType)) {
        return ensureUnixLineBreaks(urlInfo.content);
      }
      return null;
    },
  };
};

const jsenvPluginSubbuilds = (
  subBuildParamsArray,
  { parentBuildParams, onCustomBuildDirectory, buildStart },
) => {
  if (subBuildParamsArray.length === 0) {
    return [];
  }
  return subBuildParamsArray.map((subBuildParams, index) => {
    const defaultChildBuildParams = {};
    const childBuildParams = {
      ...parentBuildParams,
      logs: {
        level: "warn",
        disabled: true,
      },
      ...defaultChildBuildParams,
      ...subBuildParams,
    };
    const subBuildDirectoryUrl = subBuildParams.buildDirectoryUrl;
    if (subBuildDirectoryUrl) {
      const subBuildRelativeUrl = urlToRelativeUrl(
        subBuildDirectoryUrl,
        parentBuildParams.buildDirectoryUrl,
      );
      const subbuildRuntimeCompat =
        childBuildParams.runtimeCompat || defaultRuntimeCompat;
      const subbuildBase =
        subBuildParams.base || getDefaultBase(subbuildRuntimeCompat);
      childBuildParams.base = `${subbuildBase}${subBuildRelativeUrl}`;
      onCustomBuildDirectory(subBuildRelativeUrl);
    }
    const buildPromise = buildStart(childBuildParams, index);
    const entryPointBuildUrlMap = new Map();
    const entryPointSourceUrlSet = new Set();
    const entryPointBuildUrlSet = new Set();
    const childBuildEntryPoints = childBuildParams.entryPoints;
    for (const key of Object.keys(childBuildEntryPoints)) {
      const entryPointUrl = new URL(key, childBuildParams.sourceDirectoryUrl)
        .href;
      const entryPointBuildUrl = new URL(
        childBuildEntryPoints[key],
        childBuildParams.buildDirectoryUrl,
      ).href;
      entryPointBuildUrlMap.set(entryPointUrl, entryPointBuildUrl);
      entryPointSourceUrlSet.add(entryPointUrl);
      entryPointBuildUrlSet.add(entryPointBuildUrl);
    }

    return {
      name: `jsenv:subbuild_${index}`,
      redirectReference: (reference) => {
        const entryPointBuildUrl = entryPointBuildUrlMap.get(reference.url);
        if (!entryPointBuildUrl) {
          return null;
        }
        return entryPointBuildUrl;
      },
      fetchUrlContent: async (urlInfo) => {
        if (!entryPointBuildUrlSet.has(urlInfo.url)) {
          return;
        }
        await buildPromise;
        urlInfo.typeHint = "asset"; // this ensure the rest of jsenv do not scan or modify the content of this file
      },
    };
  });
};

/*
 * Build is split in 3 steps:
 * 1. craft
 * 2. shape
 * 3. refine
 *
 * craft: prepare all the materials
 *  - resolve, fetch and transform all source files into "rawKitchen.graph"
 * shape: this step can drastically change url content and their relationships
 *  - bundling
 *  - optimizations (minification)
 * refine: perform minor changes on the url contents
 *  - cleaning html
 *  - url versioning
 *  - ressource hints
 *  - injecting urls into service workers
 */


/**
 * Generate an optimized version of source files into a directory.
 *
 * @param {Object} params
 * @param {string|url} params.sourceDirectoryUrl
 *        Directory containing source files
 * @param {string|url} params.buildDirectoryUrl
 *        Directory where optimized files will be written
 * @param {object} params.entryPoints
 *        Object where keys are paths to source files and values are their future name in the build directory.
 *        Keys are relative to sourceDirectoryUrl
 * @param {object} params.runtimeCompat
 *        Code generated will be compatible with these runtimes
 * @param {string} [params.assetsDirectory=""]
 *        Directory where asset files will be written
 * @param {string|url} [params.base=""]
 *        Urls in build file contents will be prefixed with this string
 * @param {boolean|object} [params.bundling=true]
 *        Reduce number of files written in the build directory
 *  @param {boolean|object} [params.minification=true]
 *        Minify the content of files written into the build directory
 * @param {boolean} [params.versioning=true]
 *        Use versioning on files written in the build directory
 * @param {('search_param'|'filename')} [params.versioningMethod="search_param"]
 *        Controls how url are versioned in the build directory
 * @param {('none'|'inline'|'file'|'programmatic')} [params.sourcemaps="none"]
 *        Generate sourcemaps in the build directory
 * @param {('error'|'copy'|'preserve')|function} [params.directoryReferenceEffect="error"]
 *        What to do when a reference leads to a directory on the filesystem
 * @return {Promise<Object>} buildReturnValue
 * @return {Promise<Object>} buildReturnValue.buildInlineContents
 *        Contains content that is inline into build files
 * @return {Promise<Object>} buildReturnValue.buildManifest
 *        Map build file paths without versioning to versioned file paths
 */
const build = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logs = logsDefault,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  assetsDirectory = "",
  runtimeCompat = defaultRuntimeCompat,
  base = getDefaultBase(runtimeCompat),
  ignore,

  subbuilds = [],
  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  magicExtensions,
  magicDirectoryIndex,
  directoryReferenceEffect,
  scenarioPlaceholders,
  injections,
  transpilation = {},
  bundling = true,
  minification = !runtimeCompat.node,
  versioning = !runtimeCompat.node,
  versioningMethod = "search_param", // "filename", "search_param"
  versioningViaImportmap = true,
  versionLength = 8,
  lineBreakNormalization = process.platform === "win32",

  sourceFilesConfig = {},
  cooldownBetweenFileEvents,
  watch = false,
  http = false,

  buildDirectoryCleanPatterns = {
    "**/*": true,
  },
  sourcemaps = "none",
  sourcemapsSourcesContent,
  writeOnFileSystem = true,
  outDirectoryUrl,
  assetManifest = versioningMethod === "filename",
  assetManifestFileRelativeUrl = "asset-manifest.json",
  returnBuildInlineContents,
  returnBuildManifest,
  ...rest
}) => {
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    // logs
    {
      if (typeof logs !== "object") {
        throw new TypeError(`logs must be an object, got ${logs}`);
      }
      const unexpectedLogsKeys = Object.keys(logs).filter(
        (key) => !Object.hasOwn(logsDefault, key),
      );
      if (unexpectedLogsKeys.length > 0) {
        throw new TypeError(
          `${unexpectedLogsKeys.join(",")}: no such key on logs`,
        );
      }
      logs = { ...logsDefault, ...logs };
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(
      buildDirectoryUrl,
      "buildDirectoryUrl",
    );
    if (outDirectoryUrl === undefined) {
      if (
        process.env.CAPTURING_SIDE_EFFECTS ||
        (false)
      ) {
        outDirectoryUrl = new URL("../.jsenv_b/", sourceDirectoryUrl);
      } else {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }

    if (typeof entryPoints !== "object" || entryPoints === null) {
      throw new TypeError(`entryPoints must be an object, got ${entryPoints}`);
    }
    const keys = Object.keys(entryPoints);
    keys.forEach((key) => {
      if (!key.startsWith("./")) {
        throw new TypeError(
          `entryPoints keys must start with "./", found ${key}`,
        );
      }
      const value = entryPoints[key];
      if (typeof value !== "string") {
        throw new TypeError(
          `entryPoints values must be strings, found "${value}" on key "${key}"`,
        );
      }
      if (value.includes("/")) {
        throw new TypeError(
          `entryPoints values must be plain strings (no "/"), found "${value}" on key "${key}"`,
        );
      }
    });
    if (!["filename", "search_param"].includes(versioningMethod)) {
      throw new TypeError(
        `versioningMethod must be "filename" or "search_param", got ${versioning}`,
      );
    }
    if (bundling === true) {
      bundling = {};
    }
    if (minification === true) {
      minification = {};
    }
  }

  if (assetsDirectory && assetsDirectory[assetsDirectory.length - 1] !== "/") {
    assetsDirectory = `${assetsDirectory}/`;
  }

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }

  const runBuild = async ({ signal, logLevel }) => {
    const logger = createLogger({ logLevel });
    const createBuildTask = (label) => {
      return createTaskLog(label, {
        disabled:
          logs.disabled || (!logger.levels.debug && !logger.levels.info),
        animated: logs.animation && !logger.levels.debug,
      });
    };

    const buildOperation = Abort.startOperation();
    buildOperation.addAbortSignal(signal);
    const entryPointKeys = Object.keys(entryPoints);
    if (entryPointKeys.length === 1) {
      logger.info(`
build "${entryPointKeys[0]}"`);
    } else {
      logger.info(`
build ${entryPointKeys.length} entry points`);
    }
    let explicitJsModuleConversion = false;
    for (const entryPointKey of entryPointKeys) {
      if (entryPointKey.includes("?js_module_fallback")) {
        explicitJsModuleConversion = true;
        break;
      }
      if (entryPointKey.includes("?as_js_classic")) {
        explicitJsModuleConversion = true;
        break;
      }
    }
    const entryUrls = [];
    const contextSharedDuringBuild = {
      buildStep: "craft",
      buildDirectoryUrl,
      assetsDirectory,
      versioning,
      versioningViaImportmap,
    };
    const rawKitchen = createKitchen({
      signal,
      logLevel: logs.level,
      rootDirectoryUrl: sourceDirectoryUrl,
      ignore,
      // during first pass (craft) we keep "ignore:" when a reference is ignored
      // so that the second pass (shape) properly ignore those urls
      ignoreProtocol: "keep",
      build: true,
      runtimeCompat,
      initialContext: contextSharedDuringBuild,
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("craft/", outDirectoryUrl)
        : undefined,
    });

    let subbuildResults = [];

    const rawPluginStore = createPluginStore([
      ...jsenvPluginSubbuilds(subbuilds, {
        parentBuildParams: {
          sourceDirectoryUrl,
          buildDirectoryUrl,
          runtimeCompat,
          bundling,
          minification,
          versioning,
          versioningMethod,
        },
        onCustomBuildDirectory: (subBuildRelativeUrl) => {
          buildDirectoryCleanPatterns = {
            ...buildDirectoryCleanPatterns,
            [`${subBuildRelativeUrl}**/*`]: false,
          };
        },
        buildStart: async (params, index) => {
          const result = await build({
            ...params,
            signal,
            handleSIGINT: false,
          });
          subbuildResults[index] = result;
          return result;
        },
      }),
      ...plugins,
      ...(bundling ? [jsenvPluginBundling(bundling)] : []),
      ...(minification ? [jsenvPluginMinification(minification)] : []),
      ...getCorePlugins({
        rootDirectoryUrl: sourceDirectoryUrl,
        runtimeCompat,
        referenceAnalysis,
        nodeEsmResolution,
        magicExtensions,
        magicDirectoryIndex,
        directoryReferenceEffect,
        injections,
        transpilation: {
          babelHelpersAsImport: !explicitJsModuleConversion,
          ...transpilation,
          jsModuleFallback: false,
        },
        inlining: false,
        http,
        scenarioPlaceholders,
      }),
    ]);
    const rawPluginController = createPluginController(
      rawPluginStore,
      rawKitchen,
    );
    rawKitchen.setPluginController(rawPluginController);

    {
      const generateSourceGraph = createBuildTask("generate source graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`craft/`, outDirectoryUrl));
        }
        const rawRootUrlInfo = rawKitchen.graph.rootUrlInfo;
        await rawRootUrlInfo.dependencies.startCollecting(() => {
          Object.keys(entryPoints).forEach((key) => {
            const entryReference = rawRootUrlInfo.dependencies.found({
              trace: { message: `"${key}" in entryPoints parameter` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: key,
              filenameHint: entryPoints[key],
            });
            entryUrls.push(entryReference.url);
          });
        });
        await rawRootUrlInfo.cookDependencies({
          operation: buildOperation,
        });
      } catch (e) {
        generateSourceGraph.fail();
        throw e;
      }
      generateSourceGraph.done();
    }

    const finalKitchen = createKitchen({
      name: "shape",
      logLevel: logs.level,
      rootDirectoryUrl: sourceDirectoryUrl,
      // here most plugins are not there
      // - no external plugin
      // - no plugin putting reference.mustIgnore on https urls
      // At this stage it's only about redirecting urls to the build directory
      // consequently only a subset or urls are supported
      supportedProtocols: ["file:", "data:", "virtual:", "ignore:"],
      ignore,
      ignoreProtocol: "remove",
      build: true,
      runtimeCompat,
      initialContext: contextSharedDuringBuild,
      sourcemaps,
      sourcemapsComment: "relative",
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("shape/", outDirectoryUrl)
        : undefined,
    });
    const buildSpecifierManager = createBuildSpecifierManager({
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
      canUseImportmap:
        versioningViaImportmap &&
        entryUrls.every((finalEntryUrl) => {
          const entryUrlInfo = rawKitchen.graph.getUrlInfo(finalEntryUrl);
          return entryUrlInfo.type === "html";
        }) &&
        rawKitchen.context.isSupportedOnCurrentClients("importmap"),
    });
    const finalPluginStore = createPluginStore([
      jsenvPluginReferenceAnalysis({
        ...referenceAnalysis,
        fetchInlineUrls: false,
        // inlineContent: false,
      }),
      jsenvPluginDirectoryReferenceEffect(directoryReferenceEffect),
      ...(lineBreakNormalization ? [jsenvPluginLineBreakNormalization()] : []),
      jsenvPluginJsModuleFallback({
        remapImportSpecifier: (specifier, parentUrl) => {
          return buildSpecifierManager.remapPlaceholder(specifier, parentUrl);
        },
      }),
      jsenvPluginInlining(),
      {
        name: "jsenv:optimize",
        appliesDuring: "build",
        transformUrlContent: async (urlInfo) => {
          await rawKitchen.pluginController.callAsyncHooks(
            "optimizeUrlContent",
            urlInfo,
            (optimizeReturnValue) => {
              urlInfo.mutateContent(optimizeReturnValue);
            },
          );
        },
      },
      buildSpecifierManager.jsenvPluginMoveToBuildDirectory,
    ]);
    const finalPluginController = createPluginController(
      finalPluginStore,
      finalKitchen,
      {
        initialPuginsMeta: rawKitchen.pluginController.pluginsMeta,
      },
    );
    finalKitchen.setPluginController(finalPluginController);

    const bundlers = {};
    {
      for (const plugin of rawKitchen.pluginController.activePlugins) {
        const bundle = plugin.bundle;
        if (!bundle) {
          continue;
        }
        if (typeof bundle !== "object") {
          throw new Error(
            `bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`,
          );
        }
        for (const type of Object.keys(bundle)) {
          const bundleFunction = bundle[type];
          if (!bundleFunction) {
            continue;
          }
          const bundlerForThatType = bundlers[type];
          if (bundlerForThatType) {
            // first plugin to define a bundle hook wins
            continue;
          }
          bundlers[type] = {
            plugin,
            bundleFunction: bundle[type],
            urlInfoMap: new Map(),
          };
        }
      }
      const addToBundlerIfAny = (rawUrlInfo) => {
        const bundler = bundlers[rawUrlInfo.type];
        if (bundler) {
          bundler.urlInfoMap.set(rawUrlInfo.url, rawUrlInfo);
        }
      };
      // ignore unused urls thanks to "forEachUrlInfoStronglyReferenced"
      // it avoid bundling things that are not actually used
      // happens for:
      // - js import assertions
      // - conversion to js classic using ?as_js_classic or ?js_module_fallback
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        rawKitchen.graph.rootUrlInfo,
        (rawUrlInfo) => {
          if (rawUrlInfo.isEntryPoint) {
            addToBundlerIfAny(rawUrlInfo);
          }
          if (rawUrlInfo.type === "html") {
            for (const referenceToOther of rawUrlInfo.referenceToOthersSet) {
              if (
                referenceToOther.isResourceHint &&
                referenceToOther.expectedType === "js_module"
              ) {
                const referencedUrlInfo = referenceToOther.urlInfo;
                if (
                  referencedUrlInfo &&
                  // something else than the resource hint is using this url
                  referencedUrlInfo.referenceFromOthersSet.size > 0
                ) {
                  addToBundlerIfAny(referencedUrlInfo);
                  continue;
                }
              }
              if (referenceToOther.isWeak) {
                continue;
              }
              const referencedUrlInfo = referenceToOther.urlInfo;
              if (referencedUrlInfo.isInline) {
                if (referencedUrlInfo.type === "js_module") {
                  // bundle inline script type module deps
                  referencedUrlInfo.referenceToOthersSet.forEach(
                    (jsModuleReferenceToOther) => {
                      if (jsModuleReferenceToOther.type === "js_import") {
                        const inlineUrlInfo = jsModuleReferenceToOther.urlInfo;
                        addToBundlerIfAny(inlineUrlInfo);
                      }
                    },
                  );
                }
                // inline content cannot be bundled
                continue;
              }
              addToBundlerIfAny(referencedUrlInfo);
            }
            return;
          }
          // File referenced with
          // - new URL("./file.js", import.meta.url)
          // - import.meta.resolve("./file.js")
          // are entry points that should be bundled
          // For instance we will bundle service worker/workers detected like this
          if (rawUrlInfo.type === "js_module") {
            for (const referenceToOther of rawUrlInfo.referenceToOthersSet) {
              if (
                referenceToOther.type === "js_url" ||
                referenceToOther.subtype === "import_meta_resolve"
              ) {
                const referencedUrlInfo = referenceToOther.urlInfo;
                let isAlreadyBundled = false;
                for (const referenceFromOther of referencedUrlInfo.referenceFromOthersSet) {
                  if (referenceFromOther.url === referencedUrlInfo.url) {
                    if (
                      referenceFromOther.subtype === "import_dynamic" ||
                      referenceFromOther.type === "script"
                    ) {
                      isAlreadyBundled = true;
                      break;
                    }
                  }
                }
                if (!isAlreadyBundled) {
                  addToBundlerIfAny(referencedUrlInfo);
                }
                continue;
              }
              if (referenceToOther.type === "js_inline_content") ;
            }
          }
        },
      );
      for (const type of Object.keys(bundlers)) {
        const bundler = bundlers[type];
        const urlInfosToBundle = Array.from(bundler.urlInfoMap.values());
        if (urlInfosToBundle.length === 0) {
          continue;
        }
        const bundleTask = createBuildTask(`bundle "${type}"`);
        try {
          await buildSpecifierManager.applyBundling({
            bundler,
            urlInfosToBundle,
          });
        } catch (e) {
          bundleTask.fail();
          throw e;
        }
        bundleTask.done();
      }
    }

    {
      finalKitchen.context.buildStep = "shape";
      const generateBuildGraph = createBuildTask("generate build graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`shape/`, outDirectoryUrl));
        }
        const finalRootUrlInfo = finalKitchen.graph.rootUrlInfo;
        await finalRootUrlInfo.dependencies.startCollecting(() => {
          entryUrls.forEach((entryUrl) => {
            finalRootUrlInfo.dependencies.found({
              trace: { message: `entryPoint` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: entryUrl,
            });
          });
        });
        await finalRootUrlInfo.cookDependencies({
          operation: buildOperation,
        });
      } catch (e) {
        generateBuildGraph.fail();
        throw e;
      }
      generateBuildGraph.done();
    }

    {
      finalKitchen.context.buildStep = "refine";

      const htmlRefineSet = new Set();
      const registerHtmlRefine = (htmlRefine) => {
        htmlRefineSet.add(htmlRefine);
      };

      {
        await buildSpecifierManager.replacePlaceholders();
      }

      /*
       * Update <link rel="preload"> and friends after build (once we know everything)
       * - Used to remove resource hint targeting an url that is no longer used:
       *   - because of bundlings
       *   - because of import assertions transpilation (file is inlined into JS)
       */
      {
        buildSpecifierManager.prepareResyncResourceHints({
          registerHtmlRefine,
        });
      }

      {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          if (urlInfo.type !== "html") {
            return;
          }
          const htmlAst = parseHtml({
            html: urlInfo.content,
            url: urlInfo.url,
            storeOriginalPositions: false,
          });
          for (const htmlRefine of htmlRefineSet) {
            const htmlMutationCallbackSet = new Set();
            const registerHtmlMutation = (callback) => {
              htmlMutationCallbackSet.add(callback);
            };
            htmlRefine(htmlAst, { registerHtmlMutation });
            for (const htmlMutationCallback of htmlMutationCallbackSet) {
              htmlMutationCallback();
            }
          }
          // cleanup jsenv attributes from html as a last step
          urlInfo.content = stringifyHtmlAst(htmlAst, {
            cleanupJsenvAttributes: true,
            cleanupPositionAttributes: true,
          });
        });
      }

      {
        const inject = buildSpecifierManager.prepareServiceWorkerUrlInjection();
        if (inject) {
          const urlsInjectionInSw = createBuildTask(
            "inject urls in service worker",
          );
          await inject();
          urlsInjectionInSw.done();
          buildOperation.throwIfAborted();
        }
      }
    }
    const { buildFileContents, buildInlineContents, buildManifest } =
      buildSpecifierManager.getBuildInfo();
    if (writeOnFileSystem) {
      const writingFiles = createBuildTask("write files in build directory");
      clearDirectorySync(buildDirectoryUrl, buildDirectoryCleanPatterns);
      const buildRelativeUrls = Object.keys(buildFileContents);
      buildRelativeUrls.forEach((buildRelativeUrl) => {
        writeFileSync(
          new URL(buildRelativeUrl, buildDirectoryUrl),
          buildFileContents[buildRelativeUrl],
        );
      });
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        writeFileSync(
          new URL(assetManifestFileRelativeUrl, buildDirectoryUrl),
          JSON.stringify(buildManifest, null, "  "),
        );
      }
      writingFiles.done();
    }
    logger.info(
      createUrlGraphSummary(finalKitchen.graph, {
        title: "build files",
      }),
    );
    return {
      ...(returnBuildInlineContents ? { buildInlineContents } : {}),
      ...(returnBuildManifest ? { buildManifest } : {}),
      ...(subbuilds.length ? { subbuilds: subbuildResults } : {}),
    };
  };

  if (!watch) {
    try {
      const result = await runBuild({
        signal: operation.signal,
        logLevel: logs.level,
      });
      return result;
    } finally {
      await operation.end();
    }
  }

  let resolveFirstBuild;
  let rejectFirstBuild;
  const firstBuildPromise = new Promise((resolve, reject) => {
    resolveFirstBuild = resolve;
    rejectFirstBuild = reject;
  });
  let buildAbortController;
  let watchFilesTask;
  const startBuild = async () => {
    const buildTask = createTaskLog("build");
    buildAbortController = new AbortController();
    try {
      const result = await runBuild({
        signal: buildAbortController.signal,
        logLevel: "warn",
      });
      buildTask.done();
      resolveFirstBuild(result);
      watchFilesTask = createTaskLog("watch files");
    } catch (e) {
      if (Abort.isAbortError(e)) {
        buildTask.fail(`build aborted`);
      } else if (e.code === "PARSE_ERROR") {
        buildTask.fail();
        console.error(e.stack);
        watchFilesTask = createTaskLog("watch files");
      } else {
        buildTask.fail();
        rejectFirstBuild(e);
        throw e;
      }
    }
  };

  startBuild();
  let startTimeout;
  const stopWatchingSourceFiles = watchSourceFiles(
    sourceDirectoryUrl,
    ({ url, event }) => {
      if (watchFilesTask) {
        watchFilesTask.happen(
          `${url.slice(sourceDirectoryUrl.length)} ${event}`,
        );
        watchFilesTask = null;
      }
      buildAbortController.abort();
      // setTimeout is to ensure the abortController.abort() above
      // is properly taken into account so that logs about abort comes first
      // then logs about re-running the build happens
      clearTimeout(startTimeout);
      startTimeout = setTimeout(startBuild, 20);
    },
    {
      sourceFilesConfig,
      keepProcessAlive: true,
      cooldownBetweenFileEvents,
    },
  );
  operation.addAbortCallback(() => {
    stopWatchingSourceFiles();
  });
  await firstBuildPromise;
  return stopWatchingSourceFiles;
};

export { build };
