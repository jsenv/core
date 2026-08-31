import { bufferToEtag } from "@jsenv/filesystem";
import { formatError } from "@jsenv/humanize";
import { composeTwoResponses, fetchDirectory } from "@jsenv/server";
import { normalizeUrl } from "@jsenv/urls";
import { readFileSync, statSync } from "node:fs";

import { watchSourceFiles } from "../../helpers/watch_source_files.js";
import { WEB_URL_CONVERTER } from "../../helpers/web_url_converter.js";
import { createKitchen } from "../../kitchen/kitchen.js";
import { createJsenvPluginsController } from "../../plugins/jsenv_plugins_controller.js";
import { getRuntimeFromRequest } from "./runtime_from_request.js";

// What the newest browser supports, and nothing less: the source untouched.
// A version no browser has, so that every feature known to runtime-compat
// counts as supported.
const UNKNOWN_CLIENT_RUNTIME_COMPAT = { chrome: "9999.0.0" };

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
    let kitchen;
    // per url info, the file stat under which its content was last compared
    // with the file on disk and found identical (see isValid)
    const fileStatValidatedMap = new WeakMap();
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
    // A client we cannot identify (curl, fetch, a healthcheck, a proxy dropping
    // the user agent, the WebKit inspector re-requesting a page's resources
    // under its own agent) is served the source as it is written. Taking the
    // build targets instead would hand it the js module fallback and a heavy
    // transpilation — and, when the same page mixes identified and
    // unidentified requests, two incompatible versions of one module. An
    // actual ancient browser hiding its identity fails loudly instead, which
    // is the right failure for dev.
    const clientRuntimeCompat =
      runtimeName === "unknown"
        ? UNKNOWN_CLIENT_RUNTIME_COMPAT
        : { [runtimeName]: runtimeVersion };

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
          // The content held in memory is the file as it was read; a request
          // must never win a stale answer, whatever the watcher's latency,
          // and the ?v= a package.json decides even ends up in the browser's
          // immutable cache. So the file is checked on disk at every
          // validation — cheaply: a stat, compared with the one taken when
          // the content was read (or last found identical). Only a file
          // whose stat moved is read and hashed again.
          // Inline content (a <script> inside an html) has no file of its
          // own: it is as fresh as the html holding it, checked by the caller.
          if (!urlInfo.isInline) {
            let fileStat;
            try {
              fileStat = statSync(new URL(urlInfo.url), {
                throwIfNoEntry: false,
              });
            } catch {
              return false;
            }
            if (!fileStat) {
              urlInfo.onModified();
              return false;
            }
            const fileStatKnown =
              fileStatValidatedMap.get(urlInfo) || urlInfo.data.fileStat;
            const fileUnchanged =
              fileStatKnown &&
              fileStatKnown.mtimeMs === fileStat.mtimeMs &&
              fileStatKnown.size === fileStat.size;
            if (!fileUnchanged) {
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
                fileStatValidatedMap.delete(urlInfo);
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
              fileStatValidatedMap.set(urlInfo, {
                mtimeMs: fileStat.mtimeMs,
                size: fileStat.size,
              });
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
          if (!reference) {
            // Inline content ("page.html@L10C7-L14C16.js") has no file of its
            // own: it is served from the reference its parent creates when it
            // is cooked. Without a usable referer the parent is not known —
            // devtools re-fetching a resource on its own, a second kitchen for
            // the same page (the WebKit inspector sends its own user agent) —
            // so it is derived from the url and cooked first.
            const inlineParentUrl = getInlineContentParentUrl(requestedUrl);
            if (inlineParentUrl) {
              const inlineParentUrlInfo =
                kitchen.graph.getUrlInfo(inlineParentUrl);
              // A parent cooked before the file changed still holds the
              // references it had then; the inline content is as fresh as its
              // parent, so the parent is cooked again before being asked.
              if (
                !inlineParentUrlInfo ||
                inlineParentUrlInfo.content === undefined ||
                !inlineParentUrlInfo.contentFinalized ||
                !inlineParentUrlInfo.isValid()
              ) {
                const rootUrlInfo = kitchen.graph.rootUrlInfo;
                const inlineParentWebUrl = WEB_URL_CONVERTER.asWebUrl(
                  inlineParentUrl,
                  {
                    origin: request.origin,
                    rootDirectoryUrl: sourceDirectoryUrl,
                  },
                );
                const parentReference =
                  rootUrlInfo.dependencies.createResolveAndFinalize({
                    trace: { message: parentUrl },
                    type: "http_request",
                    specifier: inlineParentWebUrl.slice(request.origin.length),
                  });
                await parentReference.urlInfo.cook({
                  request,
                  reference: parentReference,
                });
              }
              reference = kitchen.graph.inferReference(
                request.resource,
                inlineParentUrl,
              );
              if (!reference) {
                // The parent does not hold that inline content: the script was
                // edited out of the html. What the graph kept under this url is
                // what the parent used to say, it must not be served.
                return {
                  url: requestedUrl,
                  status: 404,
                  statusText: "no inline content at this position",
                };
              }
            }
          }
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
          // The content held in memory is the response when it is finalized
          // and still valid. Content can be defined while a cook is still in
          // flight (a file watcher invalidation re-cooking in the background,
          // for instance): at that point it holds the raw fetched content,
          // transformations not applied yet. Serving that would send an html
          // without any of the injected scripts. An inline url info (a
          // <script> inside an html) is cooked again whenever the html
          // containing it is cooked: its content is as fresh as the html's,
          // so both must be valid.
          const hasFreshContent = (urlInfo) =>
            urlInfo.content !== undefined &&
            urlInfo.contentFinalized &&
            urlInfo.isValid();
          const memoryContentIsFresh = () =>
            inlineParentUrlInfo
              ? hasFreshContent(urlInfo) && hasFreshContent(inlineParentUrlInfo)
              : hasFreshContent(urlInfo);
          // a 304 goes through the hooks too: its headers stand for the
          // cached response's, they must say the same
          const augmentResponse = (response) => {
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
          };
          const respondWithNotModified = () => {
            const headers = {
              "cache-control": `private,max-age=0,must-revalidate`,
            };
            Object.keys(urlInfo.headers).forEach((key) => {
              if (key !== "content-length") {
                headers[key] = urlInfo.headers[key];
              }
            });
            return augmentResponse({
              status: 304,
              headers,
            });
          };

          try {
            if (!urlInfo.error && ifNoneMatch) {
              const [clientOriginalContentEtag, clientContentEtag] =
                ifNoneMatch.split("_");
              if (
                urlInfoTargetedByCache.originalContentEtag ===
                  clientOriginalContentEtag &&
                urlInfo.contentEtag === clientContentEtag &&
                memoryContentIsFresh()
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
              !urlInfo.response &&
              !cacheIsDisabledInResponseHeader(urlInfo) &&
              !cacheIsDisabledInResponseHeader(urlInfoTargetedByCache) &&
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
              memoryContentIsFresh();
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
              // a plugin can cook a complete response body for an url that is
              // not a 200: the directory listing does this to answer a request
              // for a file that does not exist with the explorer page
              status: urlInfo.status,
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
            return augmentResponse(response);
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
          } finally {
            // What the request put on the url info context is for this
            // request only: a cook happening later for another reason (the
            // html holding an inline script is cooked again) must not see a
            // stale "requestedUrl" and take the inline script for a direct
            // request, which would make it pick the content of a previous
            // reference (see jsenv:inline_content_fetcher).
            forgetRequestFromContext(urlInfo.context);
          }
        },
      },
    ],
  };

  return [devServerPluginRoutes, ...devServerJsenvPluginStore.allServerPlugins];
};

const forgetRequestFromContext = (context) => {
  // own properties only: what is inherited from the owner context stays
  for (const key of ["request", "requestedUrl", "reference"]) {
    if (Object.hasOwn(context, key)) {
      delete context[key];
    }
  }
};

const cacheIsDisabledInResponseHeader = (urlInfo) => {
  return (
    urlInfo.headers["cache-control"] === "no-store" ||
    urlInfo.headers["cache-control"] === "no-cache"
  );
};

// "dir/page.html@L10C7-L14C16.js" -> "dir/page.html" (search kept: it is the
// parent's). Null for anything else — the inline url grammar is the one
// generateUrlForInlineContent writes (@jsenv/ast).
const getInlineContentParentUrl = (url) => {
  const urlObject = new URL(url);
  const match = /^(.+)@[^@/]*?L\d+C\d+(?:-L\d+C\d+)?\.[a-z0-9]+$/.exec(
    urlObject.pathname,
  );
  if (!match) {
    return null;
  }
  urlObject.pathname = match[1];
  return urlObject.href;
};
