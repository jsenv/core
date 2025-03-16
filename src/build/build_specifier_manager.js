import {
  createHtmlNode,
  findHtmlNode,
  getHtmlNodeAttribute,
  insertHtmlNodeAfter,
  parseHtml,
  removeHtmlNode,
  setHtmlNodeAttributes,
  stringifyHtmlAst,
  visitHtmlNodes,
} from "@jsenv/ast";
import { comparePathnames } from "@jsenv/filesystem";
import { createDetailedMessage, UNICODE } from "@jsenv/humanize";
import { createMagicSource, generateSourcemapFileUrl } from "@jsenv/sourcemap";
import {
  ensurePathnameTrailingSlash,
  injectQueryParamIntoSpecifierWithoutEncoding,
  renderUrlOrRelativeUrlFilename,
  urlIsInsideOf,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { createHash } from "node:crypto";

import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { prependContent } from "../kitchen/prepend_content.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { isWebWorkerUrlInfo } from "../kitchen/web_workers.js";
import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import {
  injectGlobalMappings,
  injectImportmapMappings,
} from "./mappings_injection.js";

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
  getOtherEntryBuildInfo,
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
      // don't think this is needed because we'll find the rawUrlInfo
      // which contains the filenameHint
      // const otherEntryBuildInfo = getOtherEntryBuildInfo(reference.url);
      // if (otherEntryBuildInfo) {
      //   reference.filenameHint = otherEntryBuildInfo.entryUrlInfo.filenameHint;
      //   return null;
      // }

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
        dynamic_import_id: undefined,
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

      const otherEntryBuildInfo = getOtherEntryBuildInfo(rawUrl);
      if (otherEntryBuildInfo) {
        await otherEntryBuildInfo.promise;
        return {
          type: "asset", // this ensure the rest of jsenv do not try to scan or modify the content
          content: "", // still not needed
          filenameHint: otherEntryBuildInfo.entryUrlInfo.filenameHint,
        };
      }

      const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
      const bundleInfo = bundleInfoMap.get(rawUrl);
      if (bundleInfo) {
        finalUrlInfo.remapReference = bundleInfo.remapReference;
        if (!finalUrlInfo.filenameHint && bundleInfo.data.bundleRelativeUrl) {
          finalUrlInfo.filenameHint = bundleInfo.data.bundleRelativeUrl;
        }
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
          if (urlInfo.type === "asset") {
            const otherEntryBuildInfo = getOtherEntryBuildInfo(urlInfo.url);
            // TODO: check if we properly detect the other entry point
            debugger;
            if (otherEntryBuildInfo) {
              return;
            }
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

      for (const [
        contentOnlyUrlInfo,
        contentOnlyVersion,
      ] of contentOnlyVersionMap) {
        const setOfUrlInfoInfluencingVersion =
          getSetOfUrlInfoInfluencingVersion(contentOnlyUrlInfo);
        const versionPartSet = new Set();
        versionPartSet.add(contentOnlyVersion);
        for (const urlInfoInfluencingVersion of setOfUrlInfoInfluencingVersion) {
          const otherEntryBuildInfo = getOtherEntryBuildInfo(
            urlInfoInfluencingVersion.url,
          );
          // TODO: do we properly detect the ref to an other entry point here?
          debugger;
          if (otherEntryBuildInfo) {
            // TODO: how do we get the version of the other entry point build content?
            // likely somewhere in
            // otherEntryBuildInfo.buildManifest
            versionPartSet.add(
              otherEntryBuildInfo.buildManifest[
                otherEntryBuildInfo.entryUrlInfo.buildRelativeUrl
              ],
            );
            continue;
          }
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

    generate_directory_versions: {
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
    inject_global_registry_and_importmap: {
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
      sync_importmap: {
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

// export for unit tests
export { generateVersion };
