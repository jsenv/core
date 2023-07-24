import {
  urlIsInsideOf,
  moveUrl,
  normalizeUrl,
  setUrlFilename,
} from "@jsenv/urls";
import { URL_META } from "@jsenv/url-meta";
import { ensureWindowsDriveLetter } from "@jsenv/filesystem";
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

const inlineContentClientFileUrl = new URL(
  "./client/inline_content.js",
  import.meta.url,
).href;

export const createKitchen = ({
  name,
  signal,
  logLevel,

  rootDirectoryUrl,
  mainFilePath,
  ignore,
  ignoreProtocol = "remove",
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"],
  dev = false,
  build = false,
  shape = false,
  runtimeCompat,
  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  plugins,
  supervisor,
  sourcemaps = dev ? "inline" : "none", // "programmatic" and "file" also allowed
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
  outDirectoryUrl,
  initialContext = {},
  initialPluginsMeta = {},
}) => {
  const logger = createLogger({ logLevel });
  const kitchen = {
    context: {
      ...initialContext,
      kitchen: null,
      signal,
      logger,
      rootDirectoryUrl,
      mainFilePath,
      dev,
      build,
      shape,
      runtimeCompat,
      clientRuntimeCompat,
      inlineContentClientFileUrl,
      isSupportedOnCurrentClients: memoizeIsSupported(clientRuntimeCompat),
      isSupportedOnFutureClients: memoizeIsSupported(runtimeCompat),
      getPluginMeta: null,
      sourcemaps,
      outDirectoryUrl,
    },
    graph: null,
    pluginController: null,
    urlInfoTransformer: null,
  };
  const kitchenContext = kitchen.context;
  kitchenContext.kitchen = kitchen;

  const graph = createUrlGraph({
    name,
    rootDirectoryUrl,
    kitchen,
  });
  kitchen.graph = graph;

  const pluginController = createPluginController(
    kitchenContext,
    initialPluginsMeta,
  );
  kitchen.pluginController = pluginController;
  kitchenContext.getPluginMeta = pluginController.getPluginMeta;
  plugins.forEach((pluginEntry) => {
    pluginController.pushPlugin(pluginEntry);
  });

  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    sourcemaps,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    sourcemapsSourcesRelative,
    outDirectoryUrl,
    supervisor,
  });
  kitchen.urlInfoTransformer = urlInfoTransformer;

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
        if (reference.url) {
          setReferenceUrl(reference.url);
          break resolve;
        }
        const resolvedUrl = pluginController.callHooksUntil(
          "resolveReference",
          reference,
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
        if (reference.isImplicit && reference.isWeak) {
          // not needed for implicit references that are not rendered anywhere
          // this condition excludes:
          // - side_effect_file references injected in entry points or at the top of files
          break redirect;
        }
        pluginController.callHooks(
          "redirectReference",
          reference,
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

  const finalizeReference = (reference) => {
    if (reference.isImplicit && reference.isWeak) {
      // not needed for implicit references that are not rendered anywhere
      // this condition excludes:
      // - side_effect_file references injected in entry points or at the top of files
      return;
    }

    transform_search_params: {
      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hot)
      // But do not represent an other resource, it is considered as
      // the same resource under the hood
      const searchParamTransformationMap = new Map();
      pluginController.callHooks(
        "transformReferenceSearchParams",
        reference,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            searchParamTransformationMap.set(key, returnValue[key]);
          });
        },
      );
      if (searchParamTransformationMap.size) {
        const generatedSearchParams = new URLSearchParams(
          reference.searchParams,
        );
        searchParamTransformationMap.forEach((value, key) => {
          if (value === undefined) {
            generatedSearchParams.delete(key);
          } else {
            generatedSearchParams.set(key, value);
          }
        });
        const generatedUrlObject = new URL(reference.url);
        const generatedSearch = generatedSearchParams.toString();
        generatedUrlObject.search = generatedSearch;
        reference.generatedUrl = normalizeUrl(generatedUrlObject.href);
      }
    }
    format: {
      const returnValue = pluginController.callHooksUntil(
        "formatReference",
        reference,
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
  kitchenContext.finalizeReference = finalizeReference;

  const fetchUrlContent = async (urlInfo) => {
    try {
      const fetchUrlContentReturnValue =
        await pluginController.callAsyncHooksUntil("fetchUrlContent", urlInfo);
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
      if (filename && !urlInfo.filename) {
        urlInfo.filename = filename;
      }
      assertFetchedContentCompliance({
        urlInfo,
        content,
      });
      urlInfo.generatedUrl = determineFileUrlForOutDirectory(urlInfo);

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

  const transformUrlContent = async (urlInfo) => {
    try {
      await pluginController.callAsyncHooks(
        "transformUrlContent",
        urlInfo,
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

  const finalizeUrlContent = async (urlInfo) => {
    try {
      await urlInfo.applyContentTransformationCallbacks();
      const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
        "finalizeUrlContent",
        urlInfo,
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

  const cookGuard = dev ? debounceCook : memoizeCook;
  const cook = cookGuard(async (urlInfo, contextDuringCook) => {
    if (contextDuringCook) {
      Object.assign(urlInfo.context, contextDuringCook);
    }

    // urlInfo objects are reused, they must be "reset" before cooking them again
    if (urlInfo.error || urlInfo.content !== undefined) {
      urlInfo.error = null;
      urlInfo.type = null;
      urlInfo.subtype = null;
      urlInfo.timing = {};
      urlInfoTransformer.resetContent(urlInfo);
    }

    if (!urlInfo.url.startsWith("ignore:")) {
      try {
        await urlInfo.dependencies.startCollecting(async () => {
          // "fetchUrlContent" hook
          await urlInfo.fetchContent();

          // "transform" hook
          await urlInfo.transformContent();

          // "finalize" hook
          await urlInfo.finalizeContent();
        });
      } catch (e) {
        urlInfo.error = e;
        if (e.code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
          throw e;
        }
        if (urlInfo.isInline) {
          // When something like <style> or <script> contains syntax error
          // the HTML in itself it still valid
          // keep the syntax error and continue with the HTML
          const errorInfo =
            e.code === "PARSE_ERROR"
              ? `${e.cause.reasonCode}\n${e.traceMessage}`
              : e.stack;
          logger.error(
            `Error while handling ${urlInfo.type} declared in ${urlInfo.firstReference.trace.message}:
${errorInfo}`,
          );
        } else {
          throw e;
        }
      }
    }

    // "cooked" hook
    pluginController.callHooks("cooked", urlInfo, (cookedReturnValue) => {
      if (typeof cookedReturnValue === "function") {
        const removeCallback = urlInfo.graph.urlInfoDereferencedEventEmitter.on(
          (urlInfoDereferenced, lastReferenceFromOther) => {
            if (urlInfoDereferenced === urlInfo) {
              removeCallback();
              cookedReturnValue(lastReferenceFromOther.urlInfo);
            }
          },
        );
      }
    });
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
    const seen = new Set();

    const cookSelfThenDependencies = async (urlInfo) => {
      if (operation) {
        operation.throwIfAborted();
      }
      if (seen.has(urlInfo)) {
        return;
      }
      seen.add(urlInfo);
      await urlInfo.cook();
      await startCookingDependencies(urlInfo);
    };

    const startCookingDependencies = async (urlInfo) => {
      const dependencyPromises = [];
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
        if (referenceToOther.isImplicit) {
          // implicit reference are not auto cooked
          // when needed code is explicitely cooking/fetching the underlying url
          continue;
        }
        if (
          ignoreDynamicImport &&
          referenceToOther.subtype === "import_dynamic"
        ) {
          continue;
        }
        const referencedUrlInfo = referenceToOther.urlInfo;
        const dependencyPromise = cookSelfThenDependencies(referencedUrlInfo);
        dependencyPromises.push(dependencyPromise);
      }
      await Promise.all(dependencyPromises);
    };

    await startCookingDependencies(urlInfo);
    await Promise.all(
      lastTransformationCallbacks.map(async (callback) => {
        await callback();
      }),
    );
    lastTransformationCallbacks.length = 0;
  };
  kitchenContext.cookDependencies = cookDependencies;

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
  return (feature, featureCompat) => {
    const fromCache = cache.get(feature);
    if (typeof fromCache === "boolean") {
      return fromCache;
    }
    const supported = RUNTIME_COMPAT.isSupported(
      runtimeCompat,
      feature,
      featureCompat,
    );
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

const determineFileUrlForOutDirectory = (urlInfo) => {
  if (!urlInfo.context.outDirectoryUrl) {
    return urlInfo.url;
  }
  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url;
  }
  let url = urlInfo.url;
  if (!urlIsInsideOf(urlInfo.url, urlInfo.context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url);
    url = `${urlInfo.context.rootDirectoryUrl}@fs/${url.slice(
      fsRootUrl.length,
    )}`;
  }
  if (urlInfo.filename) {
    url = setUrlFilename(url, urlInfo.filename);
  }
  return moveUrl({
    url,
    from: urlInfo.context.rootDirectoryUrl,
    to: urlInfo.context.outDirectoryUrl,
  });
};
