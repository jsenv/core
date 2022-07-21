import {
  urlIsInsideOf,
  moveUrl,
  getCallerPosition,
  stringifyUrlSite,
  normalizeUrl,
  setUrlFilename,
} from "@jsenv/urls"
import { writeFileSync, ensureWindowsDriveLetter } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/log"
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

import { createPluginController } from "../plugins/plugin_controller.js"
import { urlSpecifierEncoding } from "./url_specifier_encoding.js"
import { createUrlInfoTransformer } from "./url_graph/url_info_transformations.js"
import { RUNTIME_COMPAT } from "./compat/runtime_compat.js"
import {
  createResolveUrlError,
  createFetchUrlContentError,
  createTransformUrlContentError,
  createFinalizeUrlContentError,
} from "./errors.js"
import { assertFetchedContentCompliance } from "./fetched_content_compliance.js"
import { isWebWorkerEntryPointReference } from "./web_workers.js"

export const createKitchen = ({
  signal,
  logLevel,

  rootDirectoryUrl,
  scenario,
  runtimeCompat,
  urlGraph,
  plugins,
  sourcemaps = {
    dev: "inline", // "programmatic" and "file" also allowed
    test: "inline",
    build: "none",
  }[scenario],
  sourcemapsSourcesContent = {
    // during dev/test, chrome is able to find the sourcemap sources
    // as long as they use file:// protocol in the sourcemap files
    dev: false,
    test: false,
    build: true,
  }[scenario],
  sourcemapsRelativeSources,
  writeGeneratedFiles,
}) => {
  const logger = createLogger({ logLevel })
  const pluginController = createPluginController({
    plugins,
    scenario,
  })
  const jsenvDirectoryUrl = new URL(".jsenv/", rootDirectoryUrl).href
  const kitchenContext = {
    signal,
    logger,
    rootDirectoryUrl,
    urlGraph,
    scenario,
    runtimeCompat,
    isSupportedOnFutureClients: (feature) => {
      return RUNTIME_COMPAT.isSupported(runtimeCompat, feature)
    },
    sourcemaps,
  }
  pluginController.callHooks("init", kitchenContext)
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
    shouldHandle,
    isEntryPoint = false,
    isInline = false,
    injected = false,
    isRessourceHint = false,
    content,
    contentType,
    assert,
    assertNode,
    typePropertyNode,
  }) => {
    if (typeof specifier !== "string") {
      throw new TypeError(`"specifier" must be a string, got ${specifier}`)
    }
    return {
      original: null,
      prev: null,
      next: null,
      data,
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
      shouldHandle,
      isEntryPoint,
      isInline,
      injected,
      isRessourceHint,
      // for inline ressources the reference contains the content
      content,
      contentType,
      timing: {},
      assert,
      assertNode,
      typePropertyNode,
    }
  }
  const mutateReference = (reference, newReference) => {
    reference.next = newReference
    newReference.prev = reference
    newReference.original = reference.original || reference
    //  newReference.isEntryPoint = reference.isEntryPoint
  }
  const resolveReference = (reference) => {
    try {
      let resolvedUrl = pluginController.callHooksUntil(
        "resolveUrl",
        reference,
        kitchenContext,
      )
      if (!resolvedUrl) {
        throw new Error(`NO_RESOLVE`)
      }
      resolvedUrl = normalizeUrl(resolvedUrl)
      reference.url = resolvedUrl
      pluginController.callHooks(
        "redirectUrl",
        reference,
        kitchenContext,
        (returnValue) => {
          const normalizedReturnValue = normalizeUrl(returnValue)
          if (normalizedReturnValue === reference.url) {
            return
          }
          const previousReference = { ...reference }
          reference.url = normalizedReturnValue
          mutateReference(previousReference, reference)
        },
      )

      const referenceUrlObject = new URL(reference.url)
      reference.searchParams = referenceUrlObject.searchParams
      reference.generatedUrl = reference.url
      if (reference.searchParams.has("entry_point")) {
        reference.isEntryPoint = true
      }

      const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url)
      applyReferenceEffectsOnUrlInfo(reference, urlInfo, kitchenContext)

      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hmr)
      // But do not represent an other ressource, it is considered as
      // the same ressource under the hood
      pluginController.callHooks(
        "transformUrlSearchParams",
        reference,
        kitchenContext,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            referenceUrlObject.searchParams.set(key, returnValue[key])
          })
          reference.generatedUrl = normalizeUrl(referenceUrlObject.href)
        },
      )
      const returnValue = pluginController.callHooksUntil(
        "formatUrl",
        reference,
        kitchenContext,
      )
      reference.generatedSpecifier = returnValue || reference.generatedUrl
      reference.generatedSpecifier = urlSpecifierEncoding.encode(reference)
      return urlInfo
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error,
      })
    }
  }
  kitchenContext.resolveReference = resolveReference
  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    urlGraph,
    sourcemaps,
    sourcemapsSourcesContent,
    sourcemapsRelativeSources,
    injectSourcemapPlaceholder: ({ urlInfo, specifier }) => {
      const sourcemapReference = createReference({
        trace: {
          message: `sourcemap comment placeholder`,
          url: urlInfo.url,
        },
        type: "sourcemap_comment",
        subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
        parentUrl: urlInfo.url,
        specifier,
      })
      const sourcemapUrlInfo = resolveReference(sourcemapReference)
      sourcemapUrlInfo.type = "sourcemap"
      return [sourcemapReference, sourcemapUrlInfo]
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
      })
      const sourcemapReference = createReference({
        trace: traceFromUrlSite(sourcemapUrlSite),
        type,
        parentUrl: urlInfo.url,
        specifier,
        specifierLine,
        specifierColumn,
      })
      const sourcemapUrlInfo = resolveReference(sourcemapReference)
      sourcemapUrlInfo.type = "sourcemap"
      return [sourcemapReference, sourcemapUrlInfo]
    },
  })

  const fetchUrlContent = async (urlInfo, { reference, context }) => {
    try {
      const fetchUrlContentReturnValue =
        await pluginController.callAsyncHooksUntil(
          "fetchUrlContent",
          urlInfo,
          context,
        )
      if (!fetchUrlContentReturnValue) {
        logger.warn(
          createDetailedMessage(
            `no plugin has handled url during "fetchUrlContent" hook -> url will be ignored`,
            {
              "url": urlInfo.url,
              "url reference trace": reference.trace.message,
            },
          ),
        )
        return
      }
      let {
        content,
        contentType,
        data,
        type,
        subtype,
        originalUrl,
        originalContent,
        sourcemap,
        filename,

        status = 200,
        headers = {},
        body,
        isEntryPoint,
      } = fetchUrlContentReturnValue
      if (status !== 200) {
        throw new Error(`unexpected status, ${status}`)
      }
      if (content === undefined) {
        content = body
      }
      if (contentType === undefined) {
        contentType = headers["content-type"] || "application/octet-stream"
      }
      urlInfo.contentType = contentType
      urlInfo.headers = headers
      urlInfo.type =
        type ||
        reference.expectedType ||
        inferUrlInfoType({ url: urlInfo.url, contentType })
      urlInfo.subtype =
        subtype ||
        reference.expectedSubtype ||
        inferUrlInfoSubtype({
          url: urlInfo.url,
          type: urlInfo.type,
          subtype: urlInfo.subtype,
        })
      // during build urls info are reused and load returns originalUrl/originalContent
      urlInfo.originalUrl = originalUrl || urlInfo.originalUrl
      urlInfo.originalContent =
        originalContent === undefined ? content : originalContent
      urlInfo.content = content
      urlInfo.sourcemap = sourcemap
      if (data) {
        Object.assign(urlInfo.data, data)
      }
      if (typeof isEntryPoint === "boolean") {
        urlInfo.isEntryPoint = isEntryPoint
      }
      if (filename) {
        urlInfo.filename = filename
      }
      assertFetchedContentCompliance({
        reference,
        urlInfo,
      })
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        reference,
        error,
      })
    }
    urlInfo.generatedUrl = determineFileUrlForOutDirectory({
      urlInfo,
      context,
    })
    await urlInfoTransformer.initTransformations(urlInfo, context)
  }

  const _cook = async (urlInfo, dishContext) => {
    // during dev/test clientRuntimeCompat is a single runtime
    // during build clientRuntimeCompat is runtimeCompat
    const { clientRuntimeCompat = runtimeCompat } = dishContext
    kitchenContext.isSupportedOnCurrentClients = (feature) => {
      return RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature)
    }
    const context = {
      ...kitchenContext,
      ...dishContext,
      clientRuntimeCompat,
    }
    const { cookDuringCook = cook } = dishContext
    context.cook = (urlInfo, nestedDishContext) => {
      return cookDuringCook(urlInfo, {
        ...dishContext,
        ...nestedDishContext,
      })
    }
    context.fetchUrlContent = (urlInfo, { reference }) => {
      return fetchUrlContent(urlInfo, { reference, context })
    }

    if (urlInfo.shouldHandle) {
      // "fetchUrlContent" hook
      await fetchUrlContent(urlInfo, { reference: context.reference, context })

      // parsing
      const references = []
      const addReference = (props) => {
        const reference = createReference({
          parentUrl: urlInfo.url,
          ...props,
        })
        references.push(reference)
        const referencedUrlInfo = resolveReference(reference)
        return [reference, referencedUrlInfo]
      }
      const referenceUtils = {
        readGeneratedSpecifier: async (reference) => {
          // "formatReferencedUrl" can be async BUT this is an exception
          // for most cases it will be sync. We want to favor the sync signature to keep things simpler
          // The only case where it needs to be async is when
          // the specifier is a `data:*` url
          // in this case we'll wait for the promise returned by
          // "formatReferencedUrl"
          if (reference.generatedSpecifier.then) {
            return reference.generatedSpecifier.then((value) => {
              reference.generatedSpecifier = value
              return value
            })
          }
          return reference.generatedSpecifier
        },
        found: ({ trace, ...rest }) => {
          if (trace === undefined) {
            trace = traceFromUrlSite(
              adjustUrlSite(urlInfo, {
                urlGraph,
                url: urlInfo.url,
                line: rest.specifierLine,
                column: rest.specifierColumn,
              }),
            )
          }
          // console.log(trace)
          return addReference({
            trace,
            ...rest,
          })
        },
        foundInline: ({
          isOriginalPosition,
          specifierLine,
          specifierColumn,
          ...rest
        }) => {
          const parentUrl = isOriginalPosition
            ? urlInfo.url
            : urlInfo.generatedUrl
          const parentContent = isOriginalPosition
            ? urlInfo.originalContent
            : urlInfo.content
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
          })
        },
        update: (currentReference, newReferenceParams) => {
          const index = references.indexOf(currentReference)
          if (index === -1) {
            throw new Error(`reference do not exists`)
          }
          const previousReference = currentReference
          const nextReference = createReference({
            ...previousReference,
            ...newReferenceParams,
          })
          references[index] = nextReference
          mutateReference(previousReference, nextReference)
          const newUrlInfo = resolveReference(nextReference)
          const currentUrlInfo = context.urlGraph.getUrlInfo(
            currentReference.url,
          )
          if (
            currentUrlInfo &&
            currentUrlInfo !== newUrlInfo &&
            currentUrlInfo.dependents.size === 0
          ) {
            context.urlGraph.deleteUrlInfo(currentReference.url)
          }
          return [nextReference, newUrlInfo]
        },
        becomesInline: (
          reference,
          {
            isOriginalPosition,
            specifier,
            specifierLine,
            specifierColumn,
            contentType,
            content,
          },
        ) => {
          const parentUrl = isOriginalPosition
            ? urlInfo.url
            : urlInfo.generatedUrl
          const parentContent = isOriginalPosition
            ? urlInfo.originalContent
            : urlInfo.content
          return referenceUtils.update(reference, {
            trace: traceFromUrlSite({
              url: parentUrl,
              content: parentContent,
              line: specifierLine,
              column: specifierColumn,
            }),
            isOriginalPosition,
            isInline: true,
            specifier,
            specifierLine,
            specifierColumn,
            contentType,
            content,
          })
        },
        inject: ({ trace, ...rest }) => {
          if (trace === undefined) {
            const { url, line, column } = getCallerPosition()
            trace = traceFromUrlSite({
              url,
              line,
              column,
            })
          }
          return addReference({
            trace,
            injected: true,
            ...rest,
          })
        },
        findByGeneratedSpecifier: (generatedSpecifier) => {
          const reference = references.find(
            (ref) => ref.generatedSpecifier === generatedSpecifier,
          )
          if (!reference) {
            throw new Error(
              `No reference found using the following generatedSpecifier: "${generatedSpecifier}"`,
            )
          }
          return reference
        },
      }

      // "transform" hook
      urlInfo.references = references
      context.referenceUtils = referenceUtils
      try {
        await pluginController.callAsyncHooks(
          "transformUrlContent",
          urlInfo,
          context,
          async (transformReturnValue) => {
            await urlInfoTransformer.applyIntermediateTransformations(
              urlInfo,
              transformReturnValue,
            )
          },
        )
      } catch (error) {
        throw createTransformUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error,
        })
      }
      // after "transform" all references from originalContent
      // and the one injected by plugin are known
      urlGraph.updateReferences(urlInfo, references)

      // "finalize" hook
      try {
        const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
          "finalizeUrlContent",
          urlInfo,
          context,
        )
        await urlInfoTransformer.applyFinalTransformations(
          urlInfo,
          finalizeReturnValue,
        )
      } catch (error) {
        throw createFinalizeUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error,
        })
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
              )
              if (pruned) {
                removePrunedCallback()
                cookedReturnValue(firstUrlInfo)
              }
            },
          )
        }
      },
    )
  }
  const cook = memoizeCook(async (urlInfo, context) => {
    if (!writeGeneratedFiles || !context.outDirectoryUrl) {
      await _cook(urlInfo, context)
      return
    }
    // writing result inside ".jsenv" directory (debug purposes)
    try {
      await _cook(urlInfo, context)
    } finally {
      const { generatedUrl } = urlInfo
      if (generatedUrl && generatedUrl.startsWith("file:")) {
        if (urlInfo.type === "directory") {
          // no need to write the directory
        } else {
          writeFileSync(new URL(generatedUrl), urlInfo.content)
          const { sourcemapGeneratedUrl, sourcemap } = urlInfo
          if (sourcemapGeneratedUrl && sourcemap) {
            writeFileSync(
              new URL(sourcemapGeneratedUrl),
              JSON.stringify(sourcemap, null, "  "),
            )
          }
        }
      }
    }
  })
  kitchenContext.fetchUrlContent = fetchUrlContent
  kitchenContext.cook = cook

  const prepareEntryPoint = (params) => {
    const entryReference = createReference(params)
    entryReference.isEntryPoint = true
    const entryUrlInfo = resolveReference(entryReference)
    return [entryReference, entryUrlInfo]
  }

  const injectReference = (params) => {
    const ref = createReference(params)
    const urlInfo = resolveReference(ref)
    return [ref, urlInfo]
  }

  const fetchOriginalUrlInfo = async ({
    urlInfo,
    context,
    searchParam,
    expectedType,
  }) => {
    const urlObject = new URL(urlInfo.url)
    const { searchParams } = urlObject
    if (!searchParams.has(searchParam)) {
      return null
    }
    searchParams.delete(searchParam)
    const originalUrl = urlObject.href
    const originalReference = {
      ...(context.reference.original || context.reference),
      expectedType,
    }
    originalReference.url = originalUrl
    const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
      originalReference.url,
    )
    if (originalUrlInfo.originalUrl === undefined) {
      applyReferenceEffectsOnUrlInfo(
        originalReference,
        originalUrlInfo,
        context,
      )
    }
    await context.fetchUrlContent(originalUrlInfo, {
      reference: originalReference,
    })
    if (originalUrlInfo.dependents.size === 0) {
      context.urlGraph.deleteUrlInfo(originalUrlInfo.url)
    }
    return originalUrlInfo
  }
  kitchenContext.fetchOriginalUrlInfo = fetchOriginalUrlInfo

  return {
    pluginController,
    urlInfoTransformer,
    rootDirectoryUrl,
    jsenvDirectoryUrl,
    kitchenContext,
    cook,
    prepareEntryPoint,
    injectReference,
  }
}

const memoizeCook = (cook) => {
  const pendingDishes = new Map()
  return async (urlInfo, context) => {
    const { url, modifiedTimestamp } = urlInfo
    const pendingDish = pendingDishes.get(url)
    if (pendingDish) {
      if (!modifiedTimestamp) {
        await pendingDish.promise
        return
      }
      if (pendingDish.timestamp > modifiedTimestamp) {
        await pendingDish.promise
        return
      }
      pendingDishes.delete(url)
    }
    const timestamp = Date.now()
    const promise = cook(urlInfo, context)
    pendingDishes.set(url, {
      timestamp,
      promise,
    })
    try {
      await promise
    } finally {
      pendingDishes.delete(url)
    }
  }
}

const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  }
}

const applyReferenceEffectsOnUrlInfo = (reference, urlInfo, context) => {
  if (reference.shouldHandle) {
    urlInfo.shouldHandle = true
  } else {
    urlInfo.shouldHandle = false
  }
  urlInfo.originalUrl = urlInfo.originalUrl || reference.url

  if (reference.isEntryPoint || isWebWorkerEntryPointReference(reference)) {
    urlInfo.isEntryPoint = true
  }

  Object.assign(urlInfo.data, reference.data)
  Object.assign(urlInfo.timing, reference.timing)
  if (reference.injected) {
    urlInfo.data.injected = true
  }
  if (reference.filename) {
    urlInfo.filename = reference.filename
  }
  if (reference.isInline) {
    urlInfo.isInline = true
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
    urlInfo.inlineUrlSite = {
      url: parentUrlInfo.url,
      content: reference.isOriginalPosition
        ? parentUrlInfo.originalContent
        : parentUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    }
    urlInfo.contentType = reference.contentType
    urlInfo.originalContent =
      context === "build"
        ? urlInfo.originalContent === undefined
          ? reference.content
          : urlInfo.originalContent
        : reference.content
    urlInfo.content = reference.content
  }
}

const adjustUrlSite = (urlInfo, { urlGraph, url, line, column }) => {
  const isOriginal = url === urlInfo.url
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite
    }
    const inlineUrlSite = urlInfo.inlineUrlSite
    if (!inlineUrlSite) {
      return urlSite
    }
    const parentUrlInfo = urlGraph.getUrlInfo(inlineUrlSite.url)
    return adjust(
      {
        isOriginal: true,
        url: inlineUrlSite.url,
        content: inlineUrlSite.content,
        line: inlineUrlSite.line + urlSite.line,
        column: inlineUrlSite.column + urlSite.column,
      },
      parentUrlInfo,
    )
  }
  return adjust(
    {
      isOriginal,
      url,
      content: isOriginal ? urlInfo.originalContent : urlInfo.content,
      line,
      column,
    },
    urlInfo,
  )
}

const inferUrlInfoType = ({ url, contentType }) => {
  if (contentType === "text/html") {
    return "html"
  }
  if (contentType === "text/css") {
    return "css"
  }
  if (contentType === "text/javascript") {
    const urlObject = new URL(url)
    if (urlObject.searchParams.has("js_classic")) {
      return "js_classic"
    }
    return "js_module"
  }
  if (contentType === "application/importmap+json") {
    return "importmap"
  }
  if (contentType === "application/manifest+json") {
    return "webmanifest"
  }
  if (contentType === "image/svg+xml") {
    return "svg"
  }
  if (CONTENT_TYPE.isJson(contentType)) {
    return "json"
  }
  if (CONTENT_TYPE.isTextual(contentType)) {
    return "text"
  }
  return "other"
}

const inferUrlInfoSubtype = ({ type, subtype, url }) => {
  if (type === "js_classic" || type === "js_module") {
    const urlObject = new URL(url)
    if (urlObject.searchParams.has("worker")) {
      return "worker"
    }
    if (urlObject.searchParams.has("service_worker")) {
      return "service_worker"
    }
    if (urlObject.searchParams.has("shared_worker")) {
      return "shared_worker"
    }
    // if we are currently inside a worker, all deps are consider inside worker too
    return subtype
  }
  return ""
}

const determineFileUrlForOutDirectory = ({ urlInfo, context }) => {
  if (!context.outDirectoryUrl) {
    return urlInfo.url
  }
  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url
  }
  let url = urlInfo.url
  if (!urlIsInsideOf(urlInfo.url, context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url)
    url = `${context.rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`
  }
  if (urlInfo.filename) {
    url = setUrlFilename(url, urlInfo.filename)
  }
  return moveUrl({
    url,
    from: context.rootDirectoryUrl,
    to: context.outDirectoryUrl,
    preferAbsolute: true,
  })
}

// import { getOriginalPosition } from "@jsenv/core/src/utils/sourcemap/original_position.js"
// const getUrlSite = async (
//   urlInfo,
//   { line, column, originalLine, originalColumn },
// ) => {
//   if (typeof originalLine === "number") {
//     return {
//       url: urlInfo.url,
//       line: originalLine,
//       column: originalColumn,
//     }
//   }
//   if (urlInfo.content === urlInfo.originalContent) {
//     return {
//       url: urlInfo.url,
//       line,
//       column,
//     }
//   }
//   // at this point things were transformed: line and column are generated
//   // no sourcemap -> cannot map back to original file
//   const { sourcemap } = urlInfo
//   if (!sourcemap) {
//     return {
//       url: urlInfo.generatedUrl,
//       content: urlInfo.content,
//       line,
//       column,
//     }
//   }
//   const originalPosition = await getOriginalPosition({
//     sourcemap,
//     line,
//     column,
//   })
//   // cannot map back to original file
//   if (!originalPosition || originalPosition.line === null) {
//     return {
//       url: urlInfo.generatedUrl,
//       line,
//       column,
//     }
//   }
//   return {
//     url: urlInfo.url,
//     line: originalPosition.line,
//     column: originalPosition.column,
//   }
// }
