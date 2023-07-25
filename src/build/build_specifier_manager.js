import { createHash } from "node:crypto";
import { createDetailedMessage } from "@jsenv/log";
import { comparePathnames } from "@jsenv/filesystem";
import { createMagicSource } from "@jsenv/sourcemap";
import {
  ensurePathnameTrailingSlash,
  urlToRelativeUrl,
  injectQueryParamIntoSpecifierWithoutEncoding,
  renderUrlOrRelativeUrlFilename,
} from "@jsenv/urls";
import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  removeHtmlNode,
  createHtmlNode,
  insertHtmlNodeAfter,
  findHtmlNode,
} from "@jsenv/ast";
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
    const buildUrl = buildUrlsGenerator.generate(url, {
      urlInfo,
      ownerUrlInfo: reference.ownerUrlInfo,
    });

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
  const placeholderToBundleMap = new Map();
  const generateSpecifierForBundle = (originalUrl) => {
    const placeholder = placeholderAPI.generate();
    placeholderToBundleMap.set(placeholder, originalUrl);
    return placeholder;
  };

  const applyBundling = async ({ bundler, urlInfosToBundle }) => {
    const urlInfosBundled = await rawKitchen.pluginController.callAsyncHook(
      {
        plugin: bundler.plugin,
        hookName: "bundle",
        value: bundler.bundleFunction,
      },
      urlInfosToBundle,
    );
    Object.keys(urlInfosBundled).forEach((url) => {
      const urlInfoBundled = urlInfosBundled[url];
      if (urlInfoBundled.sourceUrls) {
        urlInfoBundled.sourceUrls.forEach((sourceUrl) => {
          const sourceRawUrlInfo = rawKitchen.graph.getUrlInfo(sourceUrl);
          if (sourceRawUrlInfo) {
            sourceRawUrlInfo.data.bundled = true;
          }
        });
      }
      bundleInfoMap.set(url, urlInfoBundled);
    });
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
      if (reference.specifier[0] === "/") {
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
    transformReferenceSearchParams: () => {
      // those search params are reflected into the build file name
      // moreover it create cleaner output
      // otherwise output is full of ?js_module_fallback search param
      return {
        js_module_fallback: undefined,
        as_json_module: undefined,
        as_css_module: undefined,
        as_text_module: undefined,
      };
    },
    formatReference: (reference) => {
      const generatedUrl = reference.generatedUrl;
      if (!generatedUrl.startsWith("file:")) {
        return null;
      }
      if (reference.isWeak) {
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
      const { firstReference } = finalUrlInfo;
      const rawUrl = firstReference.url;
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
      const rawUrlInfo = rawKitchen.graph.getUrlInfo(firstReference.url);
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
          firstReference.ownerUrlInfo.url !==
          firstReference.ownerUrlInfo.originalUrl
        ) {
          return {
            originalContent: finalUrlInfo.originalContent,
            content: firstReference.content,
            contentType: firstReference.contentType,
          };
        }
        const rawUrlInfo = GRAPH_VISITOR.find(
          rawKitchen.graph,
          (rawUrlInfoCandidate) => {
            const { inlineUrlSite } = rawUrlInfoCandidate;
            if (!inlineUrlSite) {
              return false;
            }
            if (
              inlineUrlSite.url === firstReference.ownerUrlInfo.url &&
              inlineUrlSite.line === firstReference.specifierLine &&
              inlineUrlSite.column === firstReference.specifierColumn
            ) {
              return true;
            }
            if (rawUrlInfoCandidate.content === firstReference.content) {
              return true;
            }
            if (
              rawUrlInfoCandidate.originalContent === firstReference.content
            ) {
              return true;
            }
            return false;
          },
        );
        if (rawUrlInfo) {
          return rawUrlInfo;
        }
      }
      throw new Error(createDetailedMessage(`Cannot fetch ${rawUrl}`));
    },
  };

  const buildSpecifierToBuildSpecifierVersionedMap = new Map();

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
        for (const urlInfoInfluencingVersion of setOfUrlInfoInfluencingVersion) {
          const otherUrlInfoContentVersion = contentOnlyVersionMap.get(
            urlInfoInfluencingVersion,
          );
          if (!otherUrlInfoContentVersion) {
            throw new Error(
              `cannot find content version for ${urlInfoInfluencingVersion.url} (used by ${urlInfo.url})`,
            );
          }
          versionPartSet.add(otherUrlInfoContentVersion);
        }
        const version = generateVersion(versionPartSet, versionLength);
        versionMap.set(urlInfo, version);
      });
    }
  };

  const applyVersioningOnBuildSpecifier = (buildSpecifier, reference) => {
    if (!versioning) {
      return buildSpecifier;
    }
    if (!shouldApplyVersioningOnReference(reference)) {
      return buildSpecifier;
    }
    const version = versionMap.get(reference.urlInfo);
    const buildSpecifierVersioned = injectVersionIntoBuildSpecifier({
      buildSpecifier,
      versioningMethod,
      version,
    });
    buildSpecifierToBuildSpecifierVersionedMap.set(
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
            buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
          globalMappings[buildSpecifier] = buildSpecifierVersioned;
        }
        if (versioningInfo.type === "importmap") {
          const urlInfo = reference.urlInfo;
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
          const buildSpecifier = buildUrlToBuildSpecifierMap.get(buildUrl);
          const buildSpecifierVersioned =
            buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
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
    generateSpecifierForBundle,
    applyBundling,

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
          if (mayUsePlaceholder(urlInfo)) {
            const contentBeforeReplace = urlInfo.content;
            const { content, sourcemap } = placeholderAPI.replaceAll(
              contentBeforeReplace,
              (placeholder) => {
                const reference = placeholderToReferenceMap.get(placeholder);
                return generateReplacement(reference);
              },
            );
            urlInfo.mutateContent({ content, sourcemap });
          }
        },
      );

      workerReferenceSet.clear();
      if (versioning) {
        await finishVersioning();
      }
    },

    prepareResyncResourceHints: () => {
      const actions = [];
      GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
        if (urlInfo.type !== "html") {
          return;
        }
        const htmlAst = parseHtmlString(urlInfo.content, {
          storeOriginalPositions: false,
        });
        const mutations = [];
        const hintsToInject = [];
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
                `remove resource hint because cannot find "${href}" in the graph`,
              );
              mutations.push(() => {
                removeHtmlNode(node);
              });
              return;
            }
            if (!urlInfo.isUsed()) {
              const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
              if (rawUrlInfo && rawUrlInfo.data.bundled) {
                logger.warn(
                  `remove resource hint on "${href}" because it was bundled`,
                );
                mutations.push(() => {
                  removeHtmlNode(node);
                });
                return;
              }
              logger.warn(
                `remove resource hint on "${href}" because it is not used anymore`,
              );
              mutations.push(() => {
                removeHtmlNode(node);
              });
              return;
            }
            const buildGeneratedSpecifier = getBuildGeneratedSpecifier(urlInfo);
            mutations.push(() => {
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
                hintsToInject.push({ urlInfo, node });
              }
            }
          },
        });
        hintsToInject.forEach(({ urlInfo, node }) => {
          const buildGeneratedSpecifier = getBuildGeneratedSpecifier(urlInfo);
          const found = findHtmlNode(htmlAst, (htmlNode) => {
            return (
              htmlNode.nodeName === "link" &&
              getHtmlNodeAttribute(htmlNode, "href") === buildGeneratedSpecifier
            );
          });
          if (!found) {
            mutations.push(() => {
              const nodeToInsert = createHtmlNode({
                tagName: "link",
                href: buildGeneratedSpecifier,
                rel: getHtmlNodeAttribute(node, "rel"),
                as: getHtmlNodeAttribute(node, "as"),
                type: getHtmlNodeAttribute(node, "type"),
                crossorigin: getHtmlNodeAttribute(node, "crossorigin"),
              });
              insertHtmlNodeAfter(nodeToInsert, node);
            });
          }
        });
        if (mutations.length > 0) {
          actions.push(() => {
            mutations.forEach((mutation) => mutation());
            urlInfo.mutateContent({
              content: stringifyHtmlAst(htmlAst),
            });
          });
        }
      });
      if (actions.length === 0) {
        return null;
      }
      return () => {
        actions.map((resourceHintAction) => resourceHintAction());
      };
    },

    getBuildInfo: () => {
      const buildManifest = {};
      const buildContents = {};
      const buildInlineRelativeUrlSet = new Set();
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        finalKitchen.graph.rootUrlInfo,
        (urlInfo) => {
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          const buildUrl = urlInfoToBuildUrlMap.get(urlInfo);
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
