import {
  urlIsInsideOf,
  moveUrl,
  getCallerPosition,
  stringifyUrlSite,
  normalizeUrl,
  setUrlFilename,
} from "@jsenv/urls";
import { URL_META } from "@jsenv/url-meta";
import { writeFileSync, ensureWindowsDriveLetter } from "@jsenv/filesystem";
import { createLogger, createDetailedMessage, ANSI } from "@jsenv/log";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";

import { createPluginController } from "../plugins/plugin_controller.js";
import { urlSpecifierEncoding } from "./url_specifier_encoding.js";
import { createUrlInfoTransformer } from "./url_graph/url_info_transformations.js";
import {
  createResolveUrlError,
  createFetchUrlContentError,
  createTransformUrlContentError,
  createFinalizeUrlContentError,
} from "./errors.js";
import { GRAPH_VISITOR } from "./url_graph/url_graph_visitor.js";
import { assertFetchedContentCompliance } from "./fetched_content_compliance.js";
import { isWebWorkerEntryPointReference } from "./web_workers.js";
import { prependContent } from "./prepend_content.js";

const inlineContentClientFileUrl = new URL(
  "./client/inline_content.js",
  import.meta.url,
).href;

export const createKitchen = ({
  signal,
  logLevel,

  rootDirectoryUrl,
  mainFilePath,
  ignore,
  ignoreProtocol = "remove",
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"],
  urlGraph,
  dev = false,
  build = false,
  runtimeCompat,
  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  systemJsTranspilation,
  plugins,
  minification,
  sourcemaps = dev ? "inline" : "none", // "programmatic" and "file" also allowed
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
  outDirectoryUrl,
}) => {
  const sideEffectForwardCallbacks = [];

  const logger = createLogger({ logLevel });
  const kitchenContext = {
    signal,
    logger,
    rootDirectoryUrl,
    mainFilePath,
    urlGraph,
    dev,
    build,
    runtimeCompat,
    clientRuntimeCompat,
    systemJsTranspilation,
    isSupportedOnCurrentClients: (feature) => {
      return RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature);
    },
    isSupportedOnFutureClients: (feature) => {
      return RUNTIME_COMPAT.isSupported(runtimeCompat, feature);
    },
    minification,
    sourcemaps,
    outDirectoryUrl,
  };
  const pluginController = createPluginController(kitchenContext);
  plugins.forEach((pluginEntry) => {
    pluginController.pushPlugin(pluginEntry);
  });

  const isIgnoredByProtocol = (url) => {
    const { protocol } = new URL(url);
    const protocolIsSupported = supportedProtocols.some(
      (supportedProtocol) => protocol === supportedProtocol,
    );
    return !protocolIsSupported;
  };
  let isIgnoredByParam = () => false;
  if (ignore) {
    const associations = URL_META.resolveAssociations(
      { ignore },
      rootDirectoryUrl,
    );
    const cache = new Map();
    isIgnoredByParam = (url) => {
      const fromCache = cache.get(url);
      if (fromCache) return fromCache;
      const { ignore } = URL_META.applyAssociations({
        url,
        associations,
      });
      cache.set(url, ignore);
      return ignore;
    };
  }
  const isIgnored = (url) => {
    return isIgnoredByProtocol(url) || isIgnoredByParam(url);
  };

  /*
   * - "http_request"
   * - "entry_point"
   * - "link_href"
   * - "style"
   * - "script"
   * - "a_href"
   * - "iframe_src
   * - "img_src"
   * - "img_srcset"
   * - "source_src"
   * - "source_srcset"
   * - "image_href"
   * - "use_href"
   * - "css_@import"
   * - "css_url"
   * - "js_import"
   * - "js_import_script"
   * - "js_url"
   * - "js_inline_content"
   * - "sourcemap_comment"
   * - "webmanifest_icon_src"
   * - "package_json"
   * - "side_effect_file"
   * */
  const createReference = ({
    data = {},
    node,
    trace,
    parentUrl,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filename,
    integrity,
    crossorigin,
    specifier,
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    baseUrl,
    isOriginalPosition,
    isEntryPoint = false,
    isResourceHint = false,
    isImplicit = false,
    hasVersioningEffect = false,
    injected = false,
    isInline = false,
    content,
    contentType,
    assert,
    assertNode,
    typePropertyNode,
    leadsToADirectory = false,
    debug = false,
  }) => {
    if (typeof specifier !== "string") {
      if (specifier instanceof URL) {
        specifier = specifier.href;
      } else {
        throw new TypeError(`"specifier" must be a string, got ${specifier}`);
      }
    }
    const reference = {
      original: null,
      prev: null,
      next: null,
      data,
      node,
      trace,
      parentUrl,
      url: null,
      searchParams: null,
      generatedUrl: null,
      generatedSpecifier: null,
      type,
      subtype,
      expectedContentType,
      expectedType,
      expectedSubtype,
      filename,
      integrity,
      crossorigin,
      specifier,
      specifierStart,
      specifierEnd,
      specifierLine,
      specifierColumn,
      isOriginalPosition,
      baseUrl,
      isEntryPoint,
      isResourceHint,
      isImplicit,
      hasVersioningEffect,
      version: null,
      injected,
      timing: {},
      // for inline resources the reference contains the content
      isInline,
      content,
      contentType,
      escape: null,
      // import assertions (maybe move to data?)
      assert,
      assertNode,
      typePropertyNode,
      leadsToADirectory,
      mutation: null,
      debug,
    };
    // Object.preventExtensions(reference) // useful to ensure all properties are declared here
    return reference;
  };
  const updateReference = (reference, newReference) => {
    reference.next = newReference;
    newReference.original = reference.original || reference;

    newReference.prev = reference;
  };
  const resolveReference = (reference, context = kitchenContext) => {
    const referenceContext = {
      ...context,
      resolveReference: (reference, context = referenceContext) =>
        resolveReference(reference, context),
    };
    try {
      let url = pluginController.callHooksUntil(
        "resolveReference",
        reference,
        referenceContext,
      );
      if (!url) {
        throw new Error(`NO_RESOLVE`);
      }
      if (url.includes("?debug")) {
        reference.debug = true;
      }
      url = normalizeUrl(url);
      let referencedUrlObject;
      let searchParams;
      const setReferenceUrl = (referenceUrl) => {
        // ignored urls are prefixed with "ignore:" so that reference are associated
        // to a dedicated urlInfo that is ignored.
        // this way it's only once a resource is referenced by reference that is not ignored
        // that the resource is cooked
        if (
          reference.specifier[0] === "#" &&
          // For Html, css and "#" refer to a resource in the page, reference must be preserved
          // However for js import specifiers they have a different meaning and we want
          // to resolve them (https://nodejs.org/api/packages.html#imports for instance)
          reference.type !== "js_import"
        ) {
          referenceUrl = `ignore:${referenceUrl}`;
        } else if (isIgnored(referenceUrl)) {
          referenceUrl = `ignore:${referenceUrl}`;
        }

        if (
          referenceUrl.startsWith("ignore:") &&
          !reference.specifier.startsWith("ignore:")
        ) {
          reference.specifier = `ignore:${reference.specifier}`;
        }

        referencedUrlObject = new URL(referenceUrl);
        searchParams = referencedUrlObject.searchParams;
        reference.url = referenceUrl;
        reference.searchParams = searchParams;
      };
      setReferenceUrl(url);

      if (reference.debug) {
        logger.debug(`url resolved by "${
          pluginController.getLastPluginUsed().name
        }"
${ANSI.color(reference.specifier, ANSI.GREY)} ->
${ANSI.color(reference.url, ANSI.YELLOW)}
`);
      }
      pluginController.callHooks(
        "redirectReference",
        reference,
        referenceContext,
        (returnValue, plugin) => {
          const normalizedReturnValue = normalizeUrl(returnValue);
          if (normalizedReturnValue === reference.url) {
            return;
          }
          if (reference.debug) {
            logger.debug(
              `url redirected by "${plugin.name}"
${ANSI.color(reference.url, ANSI.GREY)} ->
${ANSI.color(normalizedReturnValue, ANSI.YELLOW)}
`,
            );
          }
          const prevReference = { ...reference };
          updateReference(prevReference, reference);
          setReferenceUrl(normalizedReturnValue);
        },
      );
      reference.generatedUrl = reference.url;

      const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url);
      applyReferenceEffectsOnUrlInfo(reference, urlInfo, context);

      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hmr)
      // But do not represent an other resource, it is considered as
      // the same resource under the hood
      pluginController.callHooks(
        "transformReferenceSearchParams",
        reference,
        referenceContext,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            searchParams.set(key, returnValue[key]);
          });
          reference.generatedUrl = normalizeUrl(referencedUrlObject.href);
        },
      );

      const returnValue = pluginController.callHooksUntil(
        "formatReference",
        reference,
        referenceContext,
      );
      if (reference.url.startsWith("ignore:")) {
        if (ignoreProtocol === "remove") {
          reference.specifier = reference.specifier.slice("ignore:".length);
        }
        reference.generatedSpecifier = reference.specifier;
        reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      } else {
        reference.generatedSpecifier = returnValue || reference.generatedUrl;
        reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      }
      return [reference, urlInfo];
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error,
      });
    }
  };
  kitchenContext.resolveReference = resolveReference;

  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    urlGraph,
    sourcemaps,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    sourcemapsSourcesRelative,
    clientRuntimeCompat,
    injectSourcemapPlaceholder: ({ urlInfo, specifier }) => {
      const [sourcemapReference, sourcemapUrlInfo] = resolveReference(
        createReference({
          trace: {
            message: `sourcemap comment placeholder`,
            url: urlInfo.url,
          },
          type: "sourcemap_comment",
          expectedType: "sourcemap",
          subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
          parentUrl: urlInfo.url,
          specifier,
        }),
      );
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    },
    foundSourcemap: ({
      urlInfo,
      type,
      specifier,
      specifierLine,
      specifierColumn,
    }) => {
      const sourcemapUrlSite = adjustUrlSite(urlInfo, {
        urlGraph,
        url: urlInfo.url,
        line: specifierLine,
        column: specifierColumn,
      });
      const [sourcemapReference, sourcemapUrlInfo] = resolveReference(
        createReference({
          trace: traceFromUrlSite(sourcemapUrlSite),
          type,
          expectedType: "sourcemap",
          parentUrl: urlInfo.url,
          specifier,
          specifierLine,
          specifierColumn,
        }),
      );
      if (sourcemapReference.isInline) {
        sourcemapUrlInfo.isInline = true;
      }
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    },
  });

  const fetchUrlContent = async (
    urlInfo,
    { reference, contextDuringFetch },
  ) => {
    try {
      const fetchUrlContentReturnValue =
        await pluginController.callAsyncHooksUntil(
          "fetchUrlContent",
          urlInfo,
          contextDuringFetch,
        );
      if (!fetchUrlContentReturnValue) {
        logger.warn(
          createDetailedMessage(
            `no plugin has handled url during "fetchUrlContent" hook -> url will be ignored`,
            {
              "url": urlInfo.url,
              "url reference trace": reference.trace.message,
            },
          ),
        );
        return;
      }
      let {
        content,
        contentType,
        data,
        type,
        subtype,
        originalUrl,
        originalContent = content,
        sourcemap,
        filename,

        status = 200,
        headers = {},
        body,
        isEntryPoint,
      } = fetchUrlContentReturnValue;
      if (status !== 200) {
        throw new Error(`unexpected status, ${status}`);
      }
      if (content === undefined) {
        content = body;
      }
      if (contentType === undefined) {
        contentType = headers["content-type"] || "application/octet-stream";
      }
      urlInfo.contentType = contentType;
      urlInfo.headers = headers;
      urlInfo.type =
        type || reference.expectedType || inferUrlInfoType(urlInfo);
      urlInfo.subtype =
        subtype || reference.expectedSubtype || urlInfo.subtypeHint || "";
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl || urlInfo.originalUrl;
      if (originalContent !== urlInfo.originalContent) {
        urlInfo.originalContentEtag = undefined; // set by "initTransformations"
      }
      if (content !== urlInfo.content) {
        urlInfo.contentEtag = undefined; // set by "applyTransformationsEffects"
      }
      urlInfo.originalContent = originalContent;
      urlInfo.content = content;
      urlInfo.sourcemap = sourcemap;
      if (data) {
        Object.assign(urlInfo.data, data);
      }
      if (typeof isEntryPoint === "boolean") {
        urlInfo.isEntryPoint = isEntryPoint;
      }
      if (filename) {
        urlInfo.filename = filename;
      }
      assertFetchedContentCompliance({
        reference,
        urlInfo,
      });
      urlInfo.generatedUrl = determineFileUrlForOutDirectory({
        urlInfo,
        context: contextDuringFetch,
      });
      await urlInfoTransformer.initTransformations(urlInfo, contextDuringFetch);
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        reference,
        error,
      });
    }
  };
  kitchenContext.fetchUrlContent = fetchUrlContent;

  const _cook = async (urlInfo, dishContext) => {
    const context = {
      ...kitchenContext,
      ...dishContext,
    };
    const { cookDuringCook = cook } = dishContext;
    context.cook = (urlInfo, nestedDishContext) => {
      return cookDuringCook(urlInfo, {
        ...dishContext,
        ...nestedDishContext,
      });
    };
    context.fetchUrlContent = (urlInfo, { reference }) => {
      return fetchUrlContent(urlInfo, {
        reference,
        contextDuringFetch: context,
      });
    };

    if (!urlInfo.url.startsWith("ignore:")) {
      // references
      const references = [];
      const addReference = (props) => {
        const [reference, referencedUrlInfo] = resolveReference(
          createReference({
            parentUrl: urlInfo.url,
            ...props,
          }),
          context,
        );
        references.push(reference);
        return [reference, referencedUrlInfo];
      };
      const mutateReference = (currentReference, newReferenceParams) => {
        const index = references.indexOf(currentReference);
        if (index === -1) {
          throw new Error(`reference do not exists`);
        }
        const ref = createReference({
          ...currentReference,
          ...newReferenceParams,
        });
        const [newReference, newUrlInfo] = resolveReference(ref, context);
        updateReference(currentReference, newReference);
        references[index] = newReference;
        const currentUrlInfo = context.urlGraph.getUrlInfo(
          currentReference.url,
        );
        if (
          currentUrlInfo &&
          currentUrlInfo !== newUrlInfo &&
          currentUrlInfo.dependents.size === 0
        ) {
          context.urlGraph.deleteUrlInfo(currentReference.url);
        }
        return [newReference, newUrlInfo];
      };

      const beforeFinalizeCallbacks = [];
      context.referenceUtils = {
        inlineContentClientFileUrl,
        _references: references,
        find: (predicate) => references.find(predicate),
        readGeneratedSpecifier,
        found: ({ trace, ...rest }) => {
          if (trace === undefined) {
            trace = traceFromUrlSite(
              adjustUrlSite(urlInfo, {
                urlGraph,
                url: urlInfo.url,
                line: rest.specifierLine,
                column: rest.specifierColumn,
              }),
            );
          }
          // console.log(trace.message)
          return addReference({
            trace,
            ...rest,
          });
        },
        foundInline: ({
          isOriginalPosition,
          specifierLine,
          specifierColumn,
          ...rest
        }) => {
          const parentUrl = isOriginalPosition
            ? urlInfo.url
            : urlInfo.generatedUrl;
          const parentContent = isOriginalPosition
            ? urlInfo.originalContent
            : urlInfo.content;
          return addReference({
            trace: traceFromUrlSite({
              url: parentUrl,
              content: parentContent,
              line: specifierLine,
              column: specifierColumn,
            }),
            isOriginalPosition,
            specifierLine,
            specifierColumn,
            isInline: true,
            ...rest,
          });
        },
        foundSideEffectFile: async ({ sideEffectFileUrl, trace, ...rest }) => {
          if (trace === undefined) {
            const { url, line, column } = getCallerPosition();
            trace = traceFromUrlSite({
              url,
              line,
              column,
            });
          }

          const addRef = () =>
            addReference({
              trace,
              type: "side_effect_file",
              isImplicit: true,
              injected: true,
              specifier: sideEffectFileUrl,
              ...rest,
            });

          const injectAsBannerCodeBeforeFinalize = (
            sideEffectFileReference,
            sideEffectFileUrlInfo,
          ) => {
            beforeFinalizeCallbacks.push(async () => {
              await context.cook(sideEffectFileUrlInfo, {
                reference: sideEffectFileReference,
              });
              await context.referenceUtils.readGeneratedSpecifier(
                sideEffectFileReference,
              );
              prependContent(
                urlInfoTransformer,
                urlInfo,
                sideEffectFileUrlInfo,
              );
              context.referenceUtils.becomesInline(sideEffectFileReference, {
                specifierLine: 0,
                specifierColumn: 0,
                specifier: sideEffectFileReference.generatedSpecifier,
                content: sideEffectFileUrlInfo.content,
                contentType: sideEffectFileUrlInfo.contentType,
                parentUrl: urlInfo.url,
                parentContent: urlInfo.content,
              });
            });
            return [sideEffectFileReference, sideEffectFileUrlInfo];
          };

          // When possible we inject code inside the file in the HTML
          // -> less duplication

          // Case #1: Not possible to inject in other files -> inject as banner code
          if (!["js_classic", "js_module", "css"].includes(urlInfo.type)) {
            const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
            return injectAsBannerCodeBeforeFinalize(
              sideEffectFileReference,
              sideEffectFileUrlInfo,
            );
          }

          // Case #2: During dev
          // during dev cooking files is incremental
          // so HTML is already executed by the browser
          // but if we find that ref in a dependent we are good
          // and it's possible to find it in dependents when using
          // dynamic import for instance
          // (in that case we find the side effect file as it was injected in parent)
          if (context.dev) {
            const urlsBeforeInjection = Array.from(urlGraph.urlInfoMap.keys());
            const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
            if (!urlsBeforeInjection.includes(sideEffectFileReference.url)) {
              return injectAsBannerCodeBeforeFinalize(
                sideEffectFileReference,
                sideEffectFileUrlInfo,
              );
            }
            const isReferencingSideEffectFile = (urlInfo) =>
              urlInfo.references.some(
                (ref) => ref.url === sideEffectFileReference.url,
              );
            const selfOrAncestorIsReferencingSideEffectFile = (
              dependentUrl,
            ) => {
              const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl);
              if (isReferencingSideEffectFile(dependentUrlInfo)) {
                return true;
              }
              const dependentReferencingThatFile = GRAPH_VISITOR.findDependent(
                urlGraph,
                urlInfo,
                (ancestorUrlInfo) =>
                  isReferencingSideEffectFile(ancestorUrlInfo),
              );
              return Boolean(dependentReferencingThatFile);
            };
            for (const dependentUrl of urlInfo.dependents) {
              if (!selfOrAncestorIsReferencingSideEffectFile(dependentUrl)) {
                return injectAsBannerCodeBeforeFinalize(
                  sideEffectFileReference,
                  sideEffectFileUrlInfo,
                );
              }
            }
            return [sideEffectFileReference, sideEffectFileUrlInfo];
          }

          // Case #3: During build
          // during build, files are not executed so it's
          // possible to inject reference when discovering a side effect file
          if (urlInfo.isEntryPoint) {
            const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
            return injectAsBannerCodeBeforeFinalize(
              sideEffectFileReference,
              sideEffectFileUrlInfo,
            );
          }
          const entryPoints = urlGraph.getEntryPoints();
          const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
          for (const entryPointUrlInfo of entryPoints) {
            sideEffectForwardCallbacks.push(async () => {
              // do not inject if already there
              const { dependencies } = entryPointUrlInfo;
              if (dependencies.has(sideEffectFileUrlInfo.url)) {
                return;
              }
              dependencies.add(sideEffectFileUrlInfo.url);
              prependContent(
                urlInfoTransformer,
                entryPointUrlInfo,
                sideEffectFileUrlInfo,
              );
              await context.referenceUtils.readGeneratedSpecifier(
                sideEffectFileReference,
              );
              context.referenceUtils.becomesInline(sideEffectFileReference, {
                specifier: sideEffectFileReference.generatedSpecifier,
                // ideally get the correct line and column
                // (for js it's 0, but for html it's different)
                specifierLine: 0,
                specifierColumn: 0,
                content: sideEffectFileUrlInfo.content,
                contentType: sideEffectFileUrlInfo.contentType,
                parentUrl: entryPointUrlInfo.url,
                parentContent: entryPointUrlInfo.content,
              });
            });
          }
          return [sideEffectFileReference, sideEffectFileUrlInfo];
        },
        inject: ({ trace, ...rest }) => {
          if (trace === undefined) {
            const { url, line, column } = getCallerPosition();
            trace = traceFromUrlSite({
              url,
              line,
              column,
            });
          }
          return addReference({
            trace,
            injected: true,
            ...rest,
          });
        },
        becomesInline: (
          reference,
          {
            isOriginalPosition = reference.isOriginalPosition,
            specifier,
            specifierLine,
            specifierColumn,
            contentType,
            content,
            parentUrl = reference.parentUrl,
            parentContent,
          },
        ) => {
          const trace = traceFromUrlSite({
            url:
              parentUrl === undefined
                ? isOriginalPosition
                  ? urlInfo.url
                  : urlInfo.generatedUrl
                : parentUrl,
            content:
              parentContent === undefined
                ? isOriginalPosition
                  ? urlInfo.originalContent
                  : urlInfo.content
                : parentContent,
            line: specifierLine,
            column: specifierColumn,
          });
          return mutateReference(reference, {
            trace,
            parentUrl,
            isOriginalPosition,
            isInline: true,
            specifier,
            specifierLine,
            specifierColumn,
            contentType,
            content,
          });
        },
        becomesExternal: () => {
          throw new Error("not implemented yet");
        },
      };

      // "fetchUrlContent" hook
      await fetchUrlContent(urlInfo, {
        reference: context.reference,
        contextDuringFetch: context,
      });

      // "transform" hook
      try {
        await pluginController.callAsyncHooks(
          "transformUrlContent",
          urlInfo,
          context,
          (transformReturnValue) => {
            urlInfoTransformer.applyTransformations(
              urlInfo,
              transformReturnValue,
            );
          },
        );
      } catch (error) {
        urlGraph.updateReferences(urlInfo, references); // ensure reference are updated even in case of error
        const transformError = createTransformUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error,
        });
        urlInfo.error = transformError;
        throw transformError;
      }

      // after "transform" all references from originalContent
      // and the one injected by plugin are known
      urlGraph.updateReferences(urlInfo, references);

      // "finalize" hook
      try {
        for (const beforeFinalizeCallback of beforeFinalizeCallbacks) {
          await beforeFinalizeCallback();
        }
        beforeFinalizeCallbacks.length = 0;

        const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
          "finalizeUrlContent",
          urlInfo,
          context,
        );
        urlInfoTransformer.applyTransformations(urlInfo, finalizeReturnValue);
        urlInfoTransformer.applyTransformationsEffects(urlInfo);
      } catch (error) {
        throw createFinalizeUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error,
        });
      }
    }

    // "cooked" hook
    pluginController.callHooks(
      "cooked",
      urlInfo,
      context,
      (cookedReturnValue) => {
        if (typeof cookedReturnValue === "function") {
          const removePrunedCallback = urlGraph.prunedCallbackList.add(
            ({ prunedUrlInfos, firstUrlInfo }) => {
              const pruned = prunedUrlInfos.find(
                (prunedUrlInfo) => prunedUrlInfo.url === urlInfo.url,
              );
              if (pruned) {
                removePrunedCallback();
                cookedReturnValue(firstUrlInfo);
              }
            },
          );
        }
      },
    );
  };
  const cook = memoizeCook(async (urlInfo, context) => {
    if (!outDirectoryUrl) {
      await _cook(urlInfo, context);
      return;
    }
    // writing result inside ".jsenv" directory (debug purposes)
    try {
      await _cook(urlInfo, context);
    } finally {
      const { generatedUrl } = urlInfo;
      if (generatedUrl && generatedUrl.startsWith("file:")) {
        if (urlInfo.type === "directory") {
          // no need to write the directory
        } else if (urlInfo.content === null) {
          // Some error might lead to urlInfo.content to be null
          // (error hapenning before urlInfo.content can be set, or 404 for instance)
          // in that case we can't write anything
        } else {
          let contentIsInlined = urlInfo.isInline;
          if (
            contentIsInlined &&
            context.supervisor &&
            urlGraph.getUrlInfo(urlInfo.inlineUrlSite.url).type === "html"
          ) {
            contentIsInlined = false;
          }
          if (!contentIsInlined) {
            writeFileSync(new URL(generatedUrl), urlInfo.content);
          }
          const { sourcemapGeneratedUrl, sourcemap } = urlInfo;
          if (sourcemapGeneratedUrl && sourcemap) {
            writeFileSync(
              new URL(sourcemapGeneratedUrl),
              JSON.stringify(sourcemap, null, "  "),
            );
          }
        }
      }
    }
  });
  kitchenContext.cook = cook;

  const prepareEntryPoint = (params) => {
    return resolveReference(
      createReference({
        ...params,
        isEntryPoint: true,
      }),
    );
  };
  kitchenContext.prepareEntryPoint = prepareEntryPoint;

  const injectReference = (params) => {
    return resolveReference(createReference(params));
  };
  kitchenContext.injectReference = injectReference;

  const getWithoutSearchParam = ({
    urlInfo,
    reference,
    context,
    searchParam,
    expectedType,
  }) => {
    const urlObject = new URL(urlInfo.url);
    const { searchParams } = urlObject;
    if (!searchParams.has(searchParam)) {
      return [null, null];
    }
    searchParams.delete(searchParam);
    const originalRef =
      reference || context.reference.original || context.reference;
    const referenceWithoutSearchParam = {
      ...originalRef,
      original: originalRef,
      searchParams,
      data: { ...originalRef.data },
      expectedType,
      specifier: originalRef.specifier
        .replace(`?${searchParam}`, "")
        .replace(`&${searchParam}`, ""),
      url: normalizeUrl(urlObject.href),
      generatedSpecifier: null,
      generatedUrl: null,
      filename: null,
    };
    const urlInfoWithoutSearchParam = context.urlGraph.reuseOrCreateUrlInfo(
      referenceWithoutSearchParam.url,
    );
    if (urlInfoWithoutSearchParam.originalUrl === undefined) {
      applyReferenceEffectsOnUrlInfo(
        referenceWithoutSearchParam,
        urlInfoWithoutSearchParam,
        context,
      );
    }
    return [referenceWithoutSearchParam, urlInfoWithoutSearchParam];
  };
  kitchenContext.getWithoutSearchParam = getWithoutSearchParam;

  return {
    pluginController,
    urlInfoTransformer,
    rootDirectoryUrl,
    kitchenContext,
    cook,
    createReference,
    injectReference,
    injectForwardedSideEffectFiles: async () => {
      await Promise.all(
        sideEffectForwardCallbacks.map(async (callback) => {
          await callback();
        }),
      );
    },
  };
};

// "formatReferencedUrl" can be async BUT this is an exception
// for most cases it will be sync. We want to favor the sync signature to keep things simpler
// The only case where it needs to be async is when
// the specifier is a `data:*` url
// in this case we'll wait for the promise returned by
// "formatReferencedUrl"
const readGeneratedSpecifier = (reference) => {
  if (reference.generatedSpecifier.then) {
    return reference.generatedSpecifier.then((value) => {
      reference.generatedSpecifier = value;
      return value;
    });
  }
  return reference.generatedSpecifier;
};

const memoizeCook = (cook) => {
  const pendingDishes = new Map();
  return async (urlInfo, context) => {
    const { url, modifiedTimestamp } = urlInfo;
    const pendingDish = pendingDishes.get(url);
    if (pendingDish) {
      if (!modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }
      if (pendingDish.timestamp > modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }
      pendingDishes.delete(url);
    }
    const timestamp = Date.now();
    const promise = cook(urlInfo, context);
    pendingDishes.set(url, {
      timestamp,
      promise,
    });
    try {
      await promise;
    } finally {
      pendingDishes.delete(url);
    }
  };
};

const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

const applyReferenceEffectsOnUrlInfo = (reference, urlInfo, context) => {
  urlInfo.originalUrl = urlInfo.originalUrl || reference.url;

  if (reference.isEntryPoint || isWebWorkerEntryPointReference(reference)) {
    urlInfo.isEntryPoint = true;
  }
  Object.assign(urlInfo.data, reference.data);
  Object.assign(urlInfo.timing, reference.timing);
  if (reference.injected) {
    urlInfo.injected = true;
  }
  if (reference.filename && !urlInfo.filename) {
    urlInfo.filename = reference.filename;
  }
  if (reference.isInline) {
    urlInfo.isInline = true;
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);
    urlInfo.inlineUrlSite = {
      url: parentUrlInfo.url,
      content: reference.isOriginalPosition
        ? parentUrlInfo.originalContent
        : parentUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    };
    urlInfo.contentType = reference.contentType;
    urlInfo.originalContent = context.build
      ? urlInfo.originalContent === undefined
        ? reference.content
        : urlInfo.originalContent
      : reference.content;
    urlInfo.content = reference.content;
  }

  if (reference.debug) {
    urlInfo.debug = true;
  }
  if (reference.expectedType) {
    urlInfo.typeHint = reference.expectedType;
  }
  if (reference.expectedSubtype) {
    urlInfo.subtypeHint = reference.expectedSubtype;
  }
};

const adjustUrlSite = (urlInfo, { urlGraph, url, line, column }) => {
  const isOriginal = url === urlInfo.url;
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }
    const inlineUrlSite = urlInfo.inlineUrlSite;
    if (!inlineUrlSite) {
      return urlSite;
    }
    const parentUrlInfo = urlGraph.getUrlInfo(inlineUrlSite.url);
    return adjust(
      {
        isOriginal: true,
        url: inlineUrlSite.url,
        content: inlineUrlSite.content,
        line:
          inlineUrlSite.line === undefined
            ? urlSite.line
            : inlineUrlSite.line + urlSite.line,
        column:
          inlineUrlSite.column === undefined
            ? urlSite.column
            : inlineUrlSite.column + urlSite.column,
      },
      parentUrlInfo,
    );
  };
  return adjust(
    {
      isOriginal,
      url,
      content: isOriginal ? urlInfo.originalContent : urlInfo.content,
      line,
      column,
    },
    urlInfo,
  );
};

const inferUrlInfoType = (urlInfo) => {
  const { type } = urlInfo;
  if (type === "sourcemap") {
    return "sourcemap";
  }
  const { contentType } = urlInfo;
  if (contentType === "text/html") {
    return "html";
  }
  if (contentType === "text/css") {
    return "css";
  }
  if (contentType === "text/javascript") {
    if (urlInfo.typeHint === "js_classic") return "js_classic";
    return "js_module";
  }
  if (contentType === "application/importmap+json") {
    return "importmap";
  }
  if (contentType === "application/manifest+json") {
    return "webmanifest";
  }
  if (contentType === "image/svg+xml") {
    return "svg";
  }
  if (CONTENT_TYPE.isJson(contentType)) {
    return "json";
  }
  if (CONTENT_TYPE.isTextual(contentType)) {
    return "text";
  }
  return "other";
};

const determineFileUrlForOutDirectory = ({ urlInfo, context }) => {
  if (!context.outDirectoryUrl) {
    return urlInfo.url;
  }
  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url;
  }
  let url = urlInfo.url;
  if (!urlIsInsideOf(urlInfo.url, context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url);
    url = `${context.rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`;
  }
  if (urlInfo.filename) {
    url = setUrlFilename(url, urlInfo.filename);
  }
  return moveUrl({
    url,
    from: context.rootDirectoryUrl,
    to: context.outDirectoryUrl,
  });
};
