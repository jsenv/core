import { bufferToEtag } from "@jsenv/filesystem";
import { formatError } from "@jsenv/humanize";
import { composeTwoResponses, fetchDirectory } from "@jsenv/server";
import { URL_META } from "@jsenv/url-meta";
import { normalizeUrl } from "@jsenv/urls";
import { readFileSync } from "node:fs";

import { watchSourceFiles } from "../../helpers/watch_source_files.js";
import { WEB_URL_CONVERTER } from "../../helpers/web_url_converter.js";
import { createKitchen } from "../../kitchen/kitchen.js";
import { createJsenvPluginsController } from "../../plugins/jsenv_plugins_controller.js";
import { getRuntimeFromRequest } from "./runtime_from_request.js";

export const devServerPluginServeSourceFiles = ({
  packageDirectory,
  sourceDirectoryUrl,
  sourceMainFilePath,
  ignore,
  sourceFilesConfig,
  clientAutoreload,
  logLevel,

  runtimeCompat,
  onKitchenCreated,

  supervisor,
  sourcemaps,
  sourcemapsSourcesContent,
  outDirectoryUrl,

  serverStopAbortSignal,
  serverStopCallbackSet,
  devServerJsenvPluginStore,
  kitchenCache,
}) => {
  const { clientFileChangeEventEmitter, clientFileDereferencedEventEmitter } =
    clientAutoreload;

  const stopWatchingSourceFiles = watchSourceFiles(
    sourceDirectoryUrl,
    (fileInfo) => {
      clientFileChangeEventEmitter.emit(fileInfo);
    },
    {
      sourceFilesConfig,
      keepProcessAlive: false,
      cooldownBetweenFileEvents: clientAutoreload.cooldownBetweenFileEvents,
    },
  );
  serverStopCallbackSet.add(stopWatchingSourceFiles);

  const getOrCreateKitchen = async (request) => {
    const { runtimeName, runtimeVersion } = getRuntimeFromRequest(request);
    const runtimeId = `${runtimeName}@${runtimeVersion}`;
    const existing = kitchenCache.get(runtimeId);
    if (existing) {
      return existing;
    }
    const watchAssociations = URL_META.resolveAssociations(
      { watch: stopWatchingSourceFiles.watchPatterns },
      sourceDirectoryUrl,
    );
    let kitchen;
    clientFileChangeEventEmitter.on(({ url, event }) => {
      const urlInfo = kitchen.graph.getUrlInfo(url);
      if (urlInfo) {
        if (event === "removed") {
          urlInfo.onRemoved();
        } else {
          urlInfo.onModified();
        }
      }
    });
    const clientRuntimeCompat = { [runtimeName]: runtimeVersion };

    kitchen = createKitchen({
      name: runtimeId,
      signal: serverStopAbortSignal,
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      mainFilePath: sourceMainFilePath,
      ignore,
      dev: true,
      runtimeCompat,
      clientRuntimeCompat,
      supervisor,
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL(`${runtimeName}@${runtimeVersion}/`, outDirectoryUrl)
        : undefined,
      packageDirectory,
    });
    kitchen.graph.urlInfoCreatedEventEmitter.on((urlInfoCreated) => {
      const { watch } = URL_META.applyAssociations({
        url: urlInfoCreated.url,
        associations: watchAssociations,
      });
      urlInfoCreated.isWatched = watch;
      // when an url depends on many others, we check all these (like package.json)
      urlInfoCreated.isValid = () => {
        const seenSet = new Set();
        const checkValidity = (urlInfo) => {
          if (seenSet.has(urlInfo)) {
            return true;
          }
          seenSet.add(urlInfo);
          if (!urlInfo.url.startsWith("file:")) {
            return false;
          }
          if (urlInfo.content === undefined) {
            // urlInfo content is undefined when:
            // - url info content never fetched
            // - it is considered as modified because undelying file is watched and got saved
            // - it is considered as modified because underlying file content
            //   was compared using etag and it has changed
            return false;
          }
          // Watched files trust the watcher — except the ones marked
          // revalidateOnFileSystem (package.json files, see node_esm_resolver):
          // the watcher fires a beat AFTER a change, and what these files
          // decide (a package version, hence the ?v= the importer embeds) is
          // cached as immutable by the browser — a request racing the watcher
          // must not win a stale answer it would then keep forever.
          if (!urlInfo.isWatched || urlInfo.revalidateOnFileSystem) {
            // check the filesystem
            let fileContentAsBuffer;
            try {
              fileContentAsBuffer = readFileSync(new URL(urlInfo.url));
            } catch (e) {
              if (e.code === "ENOENT") {
                urlInfo.onModified();
                return false;
              }
              return false;
            }
            const fileContentEtag = bufferToEtag(fileContentAsBuffer);
            if (fileContentEtag !== urlInfo.originalContentEtag) {
              urlInfo.onModified();
              // restore content to be able to compare it again later
              urlInfo.kitchen.urlInfoTransformer.setContent(
                urlInfo,
                String(fileContentAsBuffer),
                {
                  contentEtag: fileContentEtag,
                },
              );
              return false;
            }
          }
          for (const implicitUrl of urlInfo.implicitUrlSet) {
            const implicitUrlInfo = urlInfo.graph.getUrlInfo(implicitUrl);
            if (!implicitUrlInfo) {
              continue;
            }
            if (implicitUrlInfo.content === undefined) {
              // happens when we explicitely load an url with a search param
              // - it creates an implicit url info to the url without params
              // - we never explicitely request the url without search param so it has no content
              // in that case the underlying urlInfo cannot be invalidate by the implicit
              // we use modifiedTimestamp to detect if the url was loaded once
              // or is just here to be used later
              if (implicitUrlInfo.modifiedTimestamp) {
                return false;
              }
              continue;
            }
            if (!checkValidity(implicitUrlInfo)) {
              return false;
            }
          }
          return true;
        };
        const valid = checkValidity(urlInfoCreated);
        return valid;
      };
    });
    kitchen.graph.urlInfoDereferencedEventEmitter.on(
      (urlInfoDereferenced, lastReferenceFromOther) => {
        clientFileDereferencedEventEmitter.emit(
          urlInfoDereferenced,
          lastReferenceFromOther,
        );
      },
    );
    const devServerJsenvPluginController = await createJsenvPluginsController(
      devServerJsenvPluginStore,
      kitchen,
    );
    kitchen.setJsenvPluginsController(devServerJsenvPluginController);

    serverStopCallbackSet.add(() => {
      devServerJsenvPluginController.callHooks("destroy", kitchen.context);
    });
    kitchenCache.set(runtimeId, kitchen);
    onKitchenCreated(kitchen);
    return kitchen;
  };

  const devServerPluginRoutes = {
    name: "jsenv:dev_server_routes",
    augmentRouteFetchSecondArg: async (request) => {
      const kitchen = await getOrCreateKitchen(request);
      return { kitchen };
    },
    routes: [
      ...devServerJsenvPluginStore.allServerRoutes,
      {
        endpoint: "GET *",
        description: "Serve project files.",
        declarationSource: import.meta.url,
        fetch: async (request, { kitchen }) => {
          const { rootDirectoryUrl, mainFilePath } = kitchen.context;
          let requestResource = request.resource;
          let requestedUrl;
          if (requestResource.startsWith("/@fs/")) {
            const fsRootRelativeUrl = requestResource.slice("/@fs/".length);
            requestedUrl = `file:///${fsRootRelativeUrl}`;
          } else {
            const requestedUrlObject = new URL(
              requestResource === "/" ? mainFilePath : requestResource.slice(1),
              rootDirectoryUrl,
            );
            requestedUrlObject.searchParams.delete("hot");
            // normalizeUrl, because searchParams.delete re-serializes the whole
            // query and turns a valueless param ("?enabled") into "?enabled=".
            // Every url in the graph is normalized the other way (kitchen.js
            // strips those "="), and requestedUrl is compared to graph urls as
            // a string: an inline urlInfo decides "is this request for me?"
            // that way (jsenv:inline_content_fetcher) and re-cooks its own
            // ALREADY COOKED content when the comparison wrongly fails.
            requestedUrl = normalizeUrl(requestedUrlObject.href);
          }
          const { referer } = request.headers;
          const parentUrl = referer
            ? WEB_URL_CONVERTER.asFileUrl(referer, {
                origin: request.origin,
                rootDirectoryUrl: sourceDirectoryUrl,
              })
            : sourceDirectoryUrl;
          let reference = kitchen.graph.inferReference(
            request.resource,
            parentUrl,
          );
          if (reference) {
            reference.urlInfo.context.request = request;
            reference.urlInfo.context.requestedUrl = requestedUrl;
          } else {
            const rootUrlInfo = kitchen.graph.rootUrlInfo;
            rootUrlInfo.context.request = request;
            rootUrlInfo.context.requestedUrl = requestedUrl;
            reference = rootUrlInfo.dependencies.createResolveAndFinalize({
              trace: { message: parentUrl },
              type: "http_request",
              specifier: request.resource,
            });
            reference.urlInfo.context.requestedUrl = requestedUrl;
            rootUrlInfo.context.request = null;
            rootUrlInfo.context.requestedUrl = null;
          }
          const urlInfo = reference.urlInfo;
          const ifNoneMatch = request.headers["if-none-match"];
          const inlineParentUrlInfo = urlInfo.findParentIfInline();
          const urlInfoTargetedByCache = inlineParentUrlInfo || urlInfo;
          const respondWithNotModified = () => {
            const headers = {
              "cache-control": `private,max-age=0,must-revalidate`,
            };
            Object.keys(urlInfo.headers).forEach((key) => {
              if (key !== "content-length") {
                headers[key] = urlInfo.headers[key];
              }
            });
            return {
              status: 304,
              headers,
            };
          };

          try {
            // an inline url info is cooked again every time the file containing it
            // is cooked, so its content is only known after cooking; its etag is
            // compared below, once cooked
            if (!urlInfo.error && ifNoneMatch && !inlineParentUrlInfo) {
              const [clientOriginalContentEtag, clientContentEtag] =
                ifNoneMatch.split("_");
              if (
                urlInfo.originalContentEtag === clientOriginalContentEtag &&
                urlInfo.contentEtag === clientContentEtag &&
                urlInfo.isValid()
              ) {
                return respondWithNotModified();
              }
            }
            // Cooking is not memoized in dev (see cookGuard in kitchen.js): a
            // request that reaches cook() re-fetches and re-transforms the file
            // even when nothing changed. The 304 path above already avoids that
            // for a browser that revalidates — but a browser with its cache
            // disabled (devtools open, the common way to reload during dev)
            // sends no if-none-match and would re-cook the entire graph on
            // every reload, turning a warm reload into seconds of transform
            // work. Same validity check as the 304 path, same trust: when the
            // graph's in-memory content is still valid, it IS the response —
            // only the status differs (200 with content, since there is no
            // client etag to match).
            const servableFromMemory =
              !urlInfo.error &&
              !inlineParentUrlInfo &&
              !urlInfo.response &&
              urlInfo.content !== undefined &&
              !cacheIsDisabledInResponseHeader(urlInfo) &&
              // a "?hot" request exists to bypass every cache, this one
              // included: it must be cooked, because cooking is what rewrites
              // its references so "?hot" cascades to the modified files below
              // (see jsenv_plugin_hot_search_param) — the memory content was
              // cooked before the change and its references carry nothing.
              // The urlInfo itself often IS valid here (hot reload of a
              // dependency: the file re-requested did not change, one below
              // it did), so isValid() alone cannot catch this.
              !request.searchParams.has("hot") &&
              // ...and the mirror guard: content cooked UNDER a "?hot" request
              // carries "?hot" in its rewritten references, and is correct for
              // that request only. Served from memory to a normal request (a
              // fresh tab), the browser would then load "file.js" from one
              // importer and "file.js?hot=..." from another — the same module
              // evaluated twice, which breaks anything module-level (e.g. a
              // signal registry throwing on duplicate ids). Re-cooking under
              // the normal request rewrites the references clean.
              !urlInfo.contentCookedForHotRequest &&
              urlInfo.isValid();
            if (!servableFromMemory) {
              await urlInfo.cook({ request, reference });
              urlInfo.contentCookedForHotRequest =
                request.searchParams.has("hot");
            }
            let { response } = urlInfo;
            if (response) {
              return response;
            }
            // the original content of an inline url info is the one of the file
            // containing it, but its cooked content is its own: it can change while
            // the containing file stays identical (an import resolving to a new
            // version of a package for instance)
            const eTag = `${urlInfoTargetedByCache.originalContentEtag}_${urlInfo.contentEtag}`;
            if (
              !urlInfo.error &&
              ifNoneMatch === eTag &&
              inlineParentUrlInfo &&
              !cacheIsDisabledInResponseHeader(urlInfoTargetedByCache)
            ) {
              return respondWithNotModified();
            }
            response = {
              url: reference.url,
              status: 200,
              headers: {
                // when we send eTag to the client the next request to the server
                // will send etag in request headers.
                // If they match jsenv bypass cooking and returns 304
                // This must not happen when a plugin uses "no-store" or "no-cache" as it means
                // plugin logic wants to happens for every request to this url
                ...(cacheIsDisabledInResponseHeader(urlInfoTargetedByCache)
                  ? {
                      "cache-control": "no-store", // for inline file we force no-store when parent is no-store
                    }
                  : {
                      "cache-control": `private,max-age=0,must-revalidate`,
                      // it's safe to use "_" separator because etag is encoded with base64 (see https://stackoverflow.com/a/13195197)
                      eTag,
                    }),
                ...urlInfo.headers,
                "content-type": urlInfo.contentType,
                "content-length": urlInfo.contentLength,
              },
              body: urlInfo.content,
              // Where the time went, readable in devtools (Network > Timing):
              // the server merges this into the server-timing header. Served
              // from memory: a marker saying so, since nothing was cooked for
              // this request. Cooked: what the kitchen measured (each plugin
              // hook, and the fetch/transform/finalize roll-ups).
              timing: servableFromMemory
                ? { "served from memory cache": null }
                : urlInfo.timing,
            };
            const augmentResponseInfo = {
              ...kitchen.context,
              reference,
              urlInfo,
            };
            kitchen.jsenvPluginsController.callHooks(
              "augmentResponse",
              augmentResponseInfo,
              (returnValue) => {
                response = composeTwoResponses(response, returnValue);
              },
            );
            return response;
          } catch (error) {
            const originalError = error ? error.cause || error : error;
            if (originalError.asResponse) {
              return originalError.asResponse();
            }
            const code = originalError.code;
            if (code === "PARSE_ERROR") {
              // when possible let browser re-throw the syntax error
              // it's not possible to do that when url info content is not available
              // (happens for js_module_fallback for instance)
              if (urlInfo.content !== undefined) {
                kitchen.context.logger
                  .error(`Error while handling ${request.url}:
  ${originalError.reasonCode || originalError.code}
  ${error.trace?.message}`);
                return {
                  url: reference.url,
                  status: 200,
                  // reason becomes the http response statusText, it must not contain invalid chars
                  // https://github.com/nodejs/node/blob/0c27ca4bc9782d658afeaebcec85ec7b28f1cc35/lib/_http_common.js#L221
                  statusText: error.reason,
                  statusMessage: originalError.message,
                  headers: {
                    "content-type": urlInfo.contentType,
                    "content-length": urlInfo.contentLength,
                    "cache-control": "no-store",
                  },
                  body: urlInfo.content,
                };
              }
              return {
                url: reference.url,
                status: 500,
                statusText: error.reason,
                statusMessage: originalError.message,
                headers: {
                  "cache-control": "no-store",
                },
                body: urlInfo.content,
              };
            }
            if (code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
              return fetchDirectory(reference.url, {
                headers: {
                  accept: "text/html",
                },
                canReadDirectory: true,
                rootDirectoryUrl: sourceDirectoryUrl,
              });
            }
            if (code === "NOT_ALLOWED") {
              return {
                url: reference.url,
                status: 403,
                statusText: originalError.reason,
              };
            }
            // MODULE_NOT_FOUND: a specifier could not be resolved to a file,
            // so something is missing on the filesystem; 500 is for the errors
            // the server does not see coming
            if (code === "NOT_FOUND" || code === "MODULE_NOT_FOUND") {
              return {
                url: reference.url,
                status: 404,
                statusText: originalError.reason,
                statusMessage: originalError.message,
              };
            }
            return {
              url: reference.url,
              status: 500,
              statusText: error.reason,
              statusMessage: formatError(error),
              headers: {
                "cache-control": "no-store",
              },
            };
          }
        },
      },
    ],
  };

  return [devServerPluginRoutes, ...devServerJsenvPluginStore.allServerPlugins];
};

const cacheIsDisabledInResponseHeader = (urlInfo) => {
  return (
    urlInfo.headers["cache-control"] === "no-store" ||
    urlInfo.headers["cache-control"] === "no-cache"
  );
};
