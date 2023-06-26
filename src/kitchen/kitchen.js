import {
  urlIsInsideOf,
  moveUrl,
  normalizeUrl,
  setUrlFilename,
} from "@jsenv/urls";
import { URL_META } from "@jsenv/url-meta";
import { writeFileSync, ensureWindowsDriveLetter } from "@jsenv/filesystem";
import { createLogger, createDetailedMessage, ANSI } from "@jsenv/log";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";

import { createUrlGraph } from "./url_graph/url_graph.js";
import { urlSpecifierEncoding } from "./url_graph/url_specifier_encoding.js";
import { createPluginController } from "../plugins/plugin_controller.js";
import { createUrlInfoTransformer } from "./url_graph/url_info_transformations.js";
import {
  createResolveUrlError,
  createFetchUrlContentError,
  createTransformUrlContentError,
  createFinalizeUrlContentError,
} from "./errors.js";
import { assertFetchedContentCompliance } from "./fetched_content_compliance.js";

export const createKitchen = ({
  name,
  signal,
  logLevel,

  rootDirectoryUrl,
  mainFilePath,
  ignore,
  ignoreProtocol = "remove",
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"],
  graph,
  dev = false,
  build = false,
  runtimeCompat,
  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  systemJsTranspilation,
  plugins,
  minification,
  supervisor,
  sourcemaps = dev ? "inline" : "none", // "programmatic" and "file" also allowed
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
  outDirectoryUrl,
}) => {
  const kitchen = {};

  if (graph === undefined) {
    graph = createUrlGraph({ name, rootDirectoryUrl, kitchen });
  }

  const logger = createLogger({ logLevel });
  const kitchenContext = {
    signal,
    logger,
    rootDirectoryUrl,
    mainFilePath,
    graph,
    dev,
    build,
    runtimeCompat,
    clientRuntimeCompat,
    systemJsTranspilation,
    isSupportedOnCurrentClients: memoizeIsSupported(clientRuntimeCompat),
    isSupportedOnFutureClients: memoizeIsSupported(runtimeCompat),
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
  const resolveReference = (reference) => {
    if (reference.url) {
      return reference;
    }

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
      Object.defineProperty(reference, "url", {
        enumerable: true,
        configurable: false,
        writable: false,
        value: referenceUrl,
      });
      reference.searchParams = new URL(referenceUrl).searchParams;
    };

    try {
      resolve: {
        const resolvedUrl = pluginController.callHooksUntil(
          "resolveReference",
          reference,
          kitchenContext,
        );
        if (!resolvedUrl) {
          throw new Error(`NO_RESOLVE`);
        }
        if (resolvedUrl.includes("?debug")) {
          reference.debug = true;
        }
        const normalizedUrl = normalizeUrl(resolvedUrl);
        setReferenceUrl(normalizedUrl);
        if (reference.debug) {
          logger.debug(`url resolved by "${
            pluginController.getLastPluginUsed().name
          }"
${ANSI.color(reference.specifier, ANSI.GREY)} ->
${ANSI.color(reference.url, ANSI.YELLOW)}
`);
        }
      }
      redirect: {
        if (reference.redirection) {
          pluginController.callHooks(
            "redirectReference",
            reference,
            kitchenContext,
            (returnValue, plugin, setReference) => {
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
              const referenceRedirected = reference.redirect(
                normalizedReturnValue,
              );
              reference = referenceRedirected;
              setReferenceUrl(normalizedReturnValue);
              setReference(referenceRedirected);
            },
          );
        }
      }
      reference.generatedUrl = reference.url;
      return reference;
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error,
      });
    }
  };
  kitchenContext.resolveReference = resolveReference;

  kitchenContext.finalizeReference = (reference) => {
    transform_search_params: {
      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hmr)
      // But do not represent an other resource, it is considered as
      // the same resource under the hood
      pluginController.callHooks(
        "transformReferenceSearchParams",
        reference,
        kitchenContext,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            reference.searchParams.set(key, returnValue[key]);
          });
          const referencedUrlObject = new URL(reference.url);
          const search = reference.searchParams.toString();
          referencedUrlObject.search = search;
          reference.generatedUrl = normalizeUrl(referencedUrlObject.href);
        },
      );
    }
    format: {
      const returnValue = pluginController.callHooksUntil(
        "formatReference",
        reference,
        kitchenContext,
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
    }
  };

  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    sourcemaps,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    sourcemapsSourcesRelative,
    clientRuntimeCompat,
  });
  kitchenContext.urlInfoTransformer = urlInfoTransformer;

  const fetchUrlContent = async (urlInfo, contextDuringFetch) => {
    try {
      urlInfoTransformer.resetContent(urlInfo);
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
              "url reference trace": urlInfo.firstReference.trace.message,
            },
          ),
        );
        return;
      }
      let {
        content,
        contentType,
        originalContent = content,
        data,
        type,
        subtype,
        originalUrl,
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
        type ||
        urlInfo.firstReference.expectedType ||
        inferUrlInfoType(urlInfo);
      urlInfo.subtype =
        subtype ||
        urlInfo.firstReference.expectedSubtype ||
        urlInfo.subtypeHint ||
        "";
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl || urlInfo.originalUrl;
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
        urlInfo,
        content,
      });
      urlInfo.generatedUrl = determineFileUrlForOutDirectory({
        urlInfo,
        context: contextDuringFetch,
      });

      // we wait here to read .contentAst and .originalContentAst
      // so that we don't trigger lazy getters
      // that would try to parse url too soon (before having urlInfo.type being set)
      // also we do not want to trigger the getters that would parse url content
      // too soon
      const contentAstDescriptor = Object.getOwnPropertyDescriptor(
        fetchUrlContentReturnValue,
        "contentAst",
      );
      const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
        fetchUrlContentReturnValue,
        "originalContentAst",
      );
      await urlInfoTransformer.setContent(urlInfo, content, {
        sourcemap,
        originalContent,
        contentAst: contentAstDescriptor
          ? contentAstDescriptor.get
            ? undefined
            : contentAstDescriptor.value
          : undefined,
        originalContentAst: originalContentAstDescriptor
          ? originalContentAstDescriptor.get
            ? undefined
            : originalContentAstDescriptor.value
          : undefined,
      });
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.fetchUrlContent = fetchUrlContent;

  const transformUrlContent = async (urlInfo, contextDuringTransform) => {
    try {
      await pluginController.callAsyncHooks(
        "transformUrlContent",
        urlInfo,
        contextDuringTransform,
        (transformReturnValue) => {
          urlInfoTransformer.applyTransformations(
            urlInfo,
            transformReturnValue,
          );
        },
      );
    } catch (error) {
      const transformError = createTransformUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
      urlInfo.error = transformError;
      throw transformError;
    }
  };
  kitchenContext.transformUrlContent = transformUrlContent;

  const finalizeUrlContent = async (urlInfo, contextDuringFinalize) => {
    try {
      await urlInfo.applyContentTransformationCallbacks();
      const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
        "finalizeUrlContent",
        urlInfo,
        contextDuringFinalize,
      );
      urlInfoTransformer.endTransformations(urlInfo, finalizeReturnValue);
    } catch (error) {
      throw createFinalizeUrlContentError({
        pluginController,
        urlInfo,
        error,
      });
    }
  };
  kitchenContext.finalizeUrlContent = finalizeUrlContent;

  let onCookStart = () => {};
  const _cook = async (urlInfo, contextDuringCook) => {
    let resolveCookPromise;
    const cookPromise = new Promise((resolve) => {
      resolveCookPromise = resolve;
    });
    onCookStart(urlInfo, cookPromise);

    if (!urlInfo.url.startsWith("ignore:")) {
      await urlInfo.dependencies.startCollecting(async () => {
        // "fetchUrlContent" hook
        await urlInfo.fetchContent();

        // "transform" hook
        await urlInfo.transformContent();

        // "finalize" hook
        await urlInfo.finalizeContent();
      }, contextDuringCook);
    }

    // "cooked" hook
    pluginController.callHooks(
      "cooked",
      urlInfo,
      contextDuringCook,
      (cookedReturnValue) => {
        if (typeof cookedReturnValue === "function") {
          const removePrunedCallback = graph.prunedCallbackList.add(
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

    resolveCookPromise();
  };
  const cookGuard = dev ? debounceCook : memoizeCook;
  const cook = cookGuard(async (urlInfo, contextDuringCook) => {
    if (!outDirectoryUrl) {
      await _cook(urlInfo, contextDuringCook);
      return;
    }
    // writing result inside ".jsenv" directory (debug purposes)
    try {
      await _cook(urlInfo, contextDuringCook);
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
            supervisor &&
            graph.getUrlInfo(urlInfo.inlineUrlSite.url).type === "html"
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

  const lastTransformationCallbacks = [];
  const addLastTransformationCallback = (callback) => {
    lastTransformationCallbacks.push(callback);
  };
  kitchenContext.addLastTransformationCallback = addLastTransformationCallback;

  const cookDependencies = async (
    urlInfo,
    { operation, ignoreDynamicImport } = {},
  ) => {
    const promises = [];
    const urlInfoSet = new Set();

    onCookStart = async (urlInfo, cookPromise) => {
      urlInfoSet.add(urlInfo);
      promises.push(cookPromise);
      await cookPromise;
      startCookingDependencies(urlInfo);
    };

    const startCookingDependencies = (urlInfo) => {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther.type === "sourcemap_comment") {
          // we don't cook sourcemap reference by sourcemap comments
          // because this is already done in "initTransformations"
          continue;
        }

        if (referenceToOther.isWeak) {
          // we don't cook weak references (resource hints mostly)
          // because they might refer to resource that will be modified during build
          // It also means something else have to reference that url in order to cook it
          // so that the preload is deleted by "resync_resource_hints.js" otherwise
          continue;
        }

        if (
          ignoreDynamicImport &&
          referenceToOther.subtype === "import_dynamic"
        ) {
          continue;
        }

        // we use reference.generatedUrl to mimic what a browser would do:
        // do a fetch to the specifier as found in the file
        const referencedUrlInfo = referenceToOther.urlInfo;
        if (!urlInfoSet.has(referencedUrlInfo)) {
          referencedUrlInfo.cook();
        }
      }
    };

    const getAllDishesAreCookedPromise = async () => {
      const waitAll = async () => {
        if (operation) {
          operation.throwIfAborted();
        }
        if (promises.length === 0) {
          return;
        }
        const promisesToWait = promises.slice();
        promises.length = 0;
        await Promise.all(promisesToWait);
        await waitAll();
      };
      await waitAll();
      urlInfoSet.clear();
    };

    startCookingDependencies(urlInfo);
    await getAllDishesAreCookedPromise();
    // gather all callbackToConsiderContentReady added after the url is cooked
    await Promise.all(
      lastTransformationCallbacks.map(async (callback) => {
        await callback();
      }),
    );
    lastTransformationCallbacks.length = 0;
    onCookStart = () => {};
  };
  kitchenContext.cookDependencies = cookDependencies;

  Object.assign(kitchen, {
    graph,
    pluginController,
    context: kitchenContext,
  });
  return kitchen;
};

const debounceCook = (cook) => {
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

const memoizeCook = (cook) => {
  const urlInfoCache = new Map();
  return async (urlInfo, context) => {
    const fromCache = urlInfoCache.get(urlInfo);
    if (fromCache) {
      await fromCache;
      return;
    }
    let resolveCookPromise;
    const promise = new Promise((resolve) => {
      resolveCookPromise = resolve;
    });
    urlInfoCache.set(urlInfo, promise);
    await cook(urlInfo, context);
    resolveCookPromise();
  };
};

const memoizeIsSupported = (runtimeCompat) => {
  const cache = new Map();
  return (feature) => {
    const fromCache = cache.get(feature);
    if (typeof fromCache === "boolean") {
      return fromCache;
    }
    const supported = RUNTIME_COMPAT.isSupported(runtimeCompat, feature);
    cache.set(feature, supported);
    return supported;
  };
};

const inferUrlInfoType = (urlInfo) => {
  const { type, typeHint } = urlInfo;
  if (type === "sourcemap" || typeHint === "sourcemap") {
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
