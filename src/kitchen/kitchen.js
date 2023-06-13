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
import { storeReferenceTransformation } from "./url_graph/reference.js";
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
  kitchen.callbacksToConsiderGraphLoaded = [];

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
          storeReferenceTransformation(prevReference, reference);
          setReferenceUrl(normalizedReturnValue);
        },
      );
      reference.generatedUrl = reference.url;

      const urlInfo = graph.reuseOrCreateUrlInfo(reference);

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
    graph,
    sourcemaps,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    sourcemapsSourcesRelative,
    clientRuntimeCompat,
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
        type || reference.expectedType || inferUrlInfoType(urlInfo);
      urlInfo.subtype =
        subtype || reference.expectedSubtype || urlInfo.subtypeHint || "";
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
        reference,
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
      await urlInfoTransformer.initTransformations(
        urlInfo,
        {
          content,
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
        },
        contextDuringFetch,
      );
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

  const _cook = async (urlInfo, customContext) => {
    const dishContext = {
      ...kitchenContext,
      ...customContext,
    };
    const { cookDuringCook = cook } = customContext;
    dishContext.cook = (urlInfo, nestedCustomContext) => {
      return cookDuringCook(urlInfo, {
        ...customContext,
        ...nestedCustomContext,
      });
    };
    dishContext.fetchUrlContent = (urlInfo, { reference }) => {
      return fetchUrlContent(urlInfo, {
        reference,
        contextDuringFetch: dishContext,
      });
    };

    if (!urlInfo.url.startsWith("ignore:")) {
      urlInfo.references.startCollecting(async () => {
        // "fetchUrlContent" hook
        await fetchUrlContent(urlInfo, {
          reference: dishContext.reference,
          contextDuringFetch: dishContext,
        });

        // "transform" hook
        try {
          await pluginController.callAsyncHooks(
            "transformUrlContent",
            urlInfo,
            dishContext,
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
            reference: dishContext.reference,
            urlInfo,
            error,
          });
          urlInfo.error = transformError;
          throw transformError;
        }
      });

      // "finalize" hook
      try {
        for (const callback of urlInfo.callbacksToConsiderContentReady) {
          await callback();
        }
        urlInfo.callbacksToConsiderContentReady.length = 0;

        const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
          "finalizeUrlContent",
          urlInfo,
          dishContext,
        );
        urlInfoTransformer.applyTransformations(urlInfo, finalizeReturnValue);
        urlInfoTransformer.applyTransformationsEffects(urlInfo);
      } catch (error) {
        throw createFinalizeUrlContentError({
          pluginController,
          reference: dishContext.reference,
          urlInfo,
          error,
        });
      }
    }

    // "cooked" hook
    pluginController.callHooks(
      "cooked",
      urlInfo,
      dishContext,
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

  Object.assign(kitchen, {
    graph,
    pluginController,
    urlInfoTransformer,
    rootDirectoryUrl,
    context: kitchenContext,
    cook,
    executePendingCallbacks: async () => {
      await Promise.all(
        kitchen.callbacksToConsiderGraphLoaded.map(async (callback) => {
          await callback();
        }),
      );
    },
  });
  return kitchen;
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
