import { ANSI, createDetailedMessage, createLogger } from "@jsenv/humanize";
import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";
import { URL_META } from "@jsenv/url-meta";
import { normalizeUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import {
  createFetchUrlContentError,
  createFinalizeUrlContentError,
  createResolveUrlError,
  createTransformUrlContentError,
  defineNonEnumerableProperties,
} from "./errors.js";
import { assertFetchedContentCompliance } from "./fetched_content_compliance.js";
import { FILE_AND_SERVER_URLS_CONVERTER } from "./file_and_server_urls_converter.js";
import {
  determineFileUrlForOutDirectory,
  determineSourcemapFileUrl,
} from "./out_directory_url.js";
import { createUrlGraph } from "./url_graph/url_graph.js";
import {
  INJECTIONS,
  isPlaceholderInjection,
} from "./url_graph/url_info_injections.js";
import { createUrlInfoTransformer } from "./url_graph/url_info_transformations.js";
import { urlSpecifierEncoding } from "./url_graph/url_specifier_encoding.js";

const inlineContentClientFileUrl = import.meta.resolve(
  "./client/inline_content.js",
);

export const createKitchen = ({
  name,
  signal,
  logLevel,

  rootDirectoryUrl,
  mainFilePath,
  dev = false,
  build = false,
  runtimeCompat,

  ignore,
  ignoreProtocol = "remove",
  supportedProtocols = [
    "file:",
    "data:",
    // eslint-disable-next-line no-script-url
    "javascript:",
    "virtual:",
    "ignore:",
    "http:",
    "https:",
    "chrome:",
    "chrome-extension:",
    "chrome-untrusted:",
    "isolated-app:",
  ],
  includedProtocols = [
    "file:",
    "data:",
    "virtual:",
    "ignore:",
    "http:",
    "https:",
  ],

  // during dev/test clientRuntimeCompat is a single runtime
  // during build clientRuntimeCompat is runtimeCompat
  clientRuntimeCompat = runtimeCompat,
  supervisor,
  sourcemaps = dev ? "inline" : "none", // "programmatic" and "file" also allowed
  sourcemapsComment,
  sourcemapsSources,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  outDirectoryUrl,
  initialContext = {},
  packageDirectory,
  packageDependencies,
}) => {
  const logger = createLogger({ logLevel });

  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
  const packageConditions = [nodeRuntimeEnabled ? "node" : "browser", "import"];
  if (nodeRuntimeEnabled) {
    supportedProtocols.push("node:");
  }

  if (packageDependencies === "auto") {
    packageDependencies = build && nodeRuntimeEnabled ? "ignore" : "include";
  }

  const kitchen = {
    context: {
      ...initialContext,
      kitchen: null,
      signal,
      logger,
      rootDirectoryUrl,
      mainFilePath,
      packageDirectory,
      dev,
      build,
      runtimeCompat,
      clientRuntimeCompat,
      inlineContentClientFileUrl,
      isSupportedOnCurrentClients: memoizeIsSupported(clientRuntimeCompat),
      isSupportedOnFutureClients: memoizeIsSupported(runtimeCompat),
      isPlaceholderInjection,
      asServerUrl: (fileUrl) =>
        FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(fileUrl, rootDirectoryUrl),
      asFileUrl: (serverUrl) =>
        FILE_AND_SERVER_URLS_CONVERTER.asFileUrl(serverUrl, rootDirectoryUrl),
      INJECTIONS,
      getPluginMeta: null,
      sourcemaps,
      outDirectoryUrl,
    },
    resolve: (specifier, importer = rootDirectoryUrl) => {
      const { url, packageDirectoryUrl, packageJson } = applyNodeEsmResolution({
        conditions: packageConditions,
        parentUrl: importer,
        specifier,
        lookupPackageScope: packageDirectory.find,
        readPackageJson: packageDirectory.read,
      });
      return { url, packageDirectoryUrl, packageJson };
    },
    graph: null,
    urlInfoTransformer: null,
    pluginController: null,
  };
  const kitchenContext = kitchen.context;
  kitchenContext.kitchen = kitchen;

  let pluginController;
  kitchen.setPluginController = (value) => {
    pluginController = kitchen.pluginController = value;
  };

  const graph = createUrlGraph({
    name,
    rootDirectoryUrl,
    kitchen,
  });
  graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
    pluginController.callHooks("urlInfoCreated", urlInfoCreated, () => {});
  });
  kitchen.graph = graph;

  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    sourcemaps,
    sourcemapsComment,
    sourcemapsSources,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
    outDirectoryUrl,
    supervisor,
  });
  kitchen.urlInfoTransformer = urlInfoTransformer;

  const isIgnoredByProtocol = (url) => {
    const { protocol } = new URL(url);
    const protocolIsIncluded = includedProtocols.includes(protocol);
    if (protocolIsIncluded) {
      return false;
    }
    return true;
  };
  const isIgnoredBecauseInPackageDependencies = (() => {
    if (packageDependencies === undefined) {
      return FUNCTION_RETURNING_FALSE;
    }
    if (packageDependencies === "include") {
      return FUNCTION_RETURNING_FALSE;
    }
    if (!packageDirectory.url) {
      return FUNCTION_RETURNING_FALSE;
    }
    const rootPackageJSON = packageDirectory.read(packageDirectory.url);
    if (!rootPackageJSON) {
      return FUNCTION_RETURNING_FALSE;
    }
    const { dependencies = {}, optionalDependencies = {} } = rootPackageJSON;
    const dependencyKeys = Object.keys(dependencies);
    const optionalDependencyKeys = Object.keys(optionalDependencies);
    const dependencySet = new Set([
      ...dependencyKeys,
      ...optionalDependencyKeys,
    ]);
    if (dependencySet.size === 0) {
      return FUNCTION_RETURNING_FALSE;
    }

    let getEffect;
    if (packageDependencies === "ignore") {
      getEffect = (dependencyName) => {
        if (!dependencySet.has(dependencyName)) {
          return "include";
        }
        return "ignore";
      };
    } else if (typeof packageDependencies === "object") {
      let defaultEffect = "ignore";
      const dependencyEffectMap = new Map();
      for (const dependencyKey of Object.keys(packageDependencies)) {
        const dependencyEffect = packageDependencies[dependencyKey];
        if (dependencyKey === "*") {
          defaultEffect = dependencyEffect;
        } else {
          dependencyEffectMap.set(dependencyKey, dependencyEffect);
        }
      }
      getEffect = (dependencyName) => {
        if (!dependencySet.has(dependencyName)) {
          return "include";
        }
        const dependencyEffect = packageDependencies[dependencyName];
        if (dependencyEffect) {
          return dependencyEffect;
        }
        return defaultEffect;
      };
    }
    return (url) => {
      if (!url.startsWith("file:")) {
        return false;
      }
      const packageDirectoryUrl = packageDirectory.find(url);
      if (!packageDirectoryUrl) {
        return false;
      }
      const packageJSON = packageDirectory.read(packageDirectoryUrl);
      const name = packageJSON?.name;
      if (!name) {
        return false;
      }
      const effect = getEffect(name);
      if (effect !== "ignore") {
        return false;
      }
      return true;
    };
  })();

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
    return (
      isIgnoredByProtocol(url) ||
      isIgnoredByParam(url) ||
      isIgnoredBecauseInPackageDependencies(url)
    );
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
      } else if (
        reference.url && reference.original
          ? isIgnored(reference.original.url)
          : isIgnored(referenceUrl)
      ) {
        if (
          referenceUrl.startsWith("node:") &&
          !reference.specifier.startsWith("node:")
        ) {
          reference.specifier = `node:${reference.specifier}`;
        }
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
      reference.generatedSearchParams = reference.searchParams;
      if (dev) {
        let url = reference.url;
        let { protocol } = new URL(url);
        if (protocol === "ignore:") {
          url = url.slice("ignore:".length);
          protocol = new URL(url, "http://example.com").protocol;
        }
        if (!supportedProtocols.includes(protocol)) {
          const protocolNotSupportedError = new Error(
            `Unsupported protocol "${protocol}" for url "${url}"`,
          );
          protocolNotSupportedError.code = "PROTOCOL_NOT_SUPPORTED";
          throw protocolNotSupportedError;
        }
      }
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
    const urlInfo = reference.urlInfo;
    urlInfo.generatedUrl = determineFileUrlForOutDirectory(urlInfo);
    urlInfo.sourcemapGeneratedUrl = determineSourcemapFileUrl(urlInfo);

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
        reference.generatedSearchParams = generatedSearchParams;
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
              "url reference trace": urlInfo.firstReference?.trace.message,
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

        status = 200,
        headers = {},
        body,
        isEntryPoint,
        isDynamicEntryPoint,
        filenameHint,
        contentSideEffects,
      } = fetchUrlContentReturnValue;
      if (content === undefined) {
        content = body;
      }
      if (contentType === undefined) {
        contentType = headers["content-type"] || "application/octet-stream";
      }
      if (filenameHint) {
        urlInfo.filenameHint = filenameHint;
      }
      urlInfo.status = status;
      urlInfo.contentType = contentType;
      urlInfo.headers = headers;
      urlInfo.type = type || inferUrlInfoType(urlInfo);
      urlInfo.subtype =
        subtype ||
        urlInfo.firstReference.expectedSubtype ||
        urlInfo.subtypeHint ||
        "";
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl
        ? String(originalUrl)
        : urlInfo.originalUrl;
      if (data) {
        Object.assign(urlInfo.data, data);
      }
      if (typeof isEntryPoint === "boolean") {
        urlInfo.isEntryPoint = isEntryPoint;
      }
      if (typeof isDynamicEntryPoint === "boolean") {
        urlInfo.isDynamicEntryPoint = isDynamicEntryPoint;
      }
      if (contentSideEffects) {
        urlInfo.contentSideEffects = contentSideEffects;
      }
      assertFetchedContentCompliance({
        urlInfo,
        content,
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
        if (urlInfo.isInline) {
          const parentUrlInfo = urlInfo.findParentIfInline();
          parentUrlInfo.error = e;
        }
        let errorWrapperMessage;
        if (e.code === "PARSE_ERROR") {
          errorWrapperMessage =
            e.name === "TRANSFORM_URL_CONTENT_ERROR"
              ? e.message
              : `parse error on "${urlInfo.type}"
${e.trace?.message}
${e.reason}
--- declared in ---
${urlInfo.firstReference.trace.message}`;
        } else if (e.isJsenvCookingError) {
          errorWrapperMessage = e.message;
        } else {
          errorWrapperMessage = `Error while cooking ${urlInfo.type}
${urlInfo.firstReference.trace.message}`;
        }
        // if we are cooking inline content during dev it's better not to throw
        // because the main url info (html) is still valid and can be returned to the browser
        if (
          urlInfo.isInline &&
          urlInfo.context.dev &&
          // but if we are explicitely requesting inline content file then we throw
          // to properly send 500 to the browser
          urlInfo.context.reference !== urlInfo.url
        ) {
          logger.error(errorWrapperMessage);
          return;
        }
        if (e.isJsenvCookingError) {
          throw e;
        }
        const error = new Error(errorWrapperMessage, { cause: e });
        defineNonEnumerableProperties(error, {
          __INTERNAL_ERROR__: true,
        });
        throw error;
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

const FUNCTION_RETURNING_FALSE = () => false;

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
  const mediaType = CONTENT_TYPE.asMediaType(urlInfo.contentType);
  const { expectedType } = urlInfo.firstReference;
  if (typeHint === "asset") {
    return "asset";
  }
  if (type === "sourcemap" || typeHint === "sourcemap") {
    return "sourcemap";
  }
  if (mediaType === "text/html") {
    return "html";
  }
  if (mediaType === "text/css") {
    return "css";
  }
  if (mediaType === "text/javascript") {
    if (expectedType === "js_classic") {
      return "js_classic";
    }
    if (typeHint === "js_classic") {
      return "js_classic";
    }
    return "js_module";
  }
  if (mediaType === "application/importmap+json") {
    return "importmap";
  }
  if (mediaType === "application/manifest+json") {
    return "webmanifest";
  }
  if (mediaType === "image/svg+xml") {
    return "svg";
  }
  if (CONTENT_TYPE.isJson(mediaType)) {
    return "json";
  }
  if (CONTENT_TYPE.isTextual(mediaType)) {
    return "text";
  }
  return expectedType || "other";
};
